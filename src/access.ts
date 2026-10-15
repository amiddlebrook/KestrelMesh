/** Account-scoped API key lifecycle. Root credential stays a Cloudflare Worker secret. */
import { body, first, list, execute, json, fail, now, uid, type Env } from './core';

export type AccessRole = 'admin' | 'operator' | 'viewer';
export type Principal = { kind: 'root' | 'key'; role: AccessRole; id: string | null; label: string; prefix: string };
type KeyRow = { id: string; label: string; role: 'operator' | 'viewer'; route_prefix: string; secret_hash: string; created_at: string; expires_at: string; revoked_at: string | null; last_used_at: string | null };
const enc = new TextEncoder();
export async function sha256(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
/** Equal-time comparison of fixed-width SHA256 hex digests. */
function compareHex(a: string, b: string): boolean {
  let mismatch = 0;
  for (let i=0; i<64; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function decodeToken(req: Request): string {
  const raw = req.headers.get('Authorization') || '';
  const m = /^Bearer ([A-Za-z0-9._~-]{12,512})$/i.exec(raw);
  return m ? m[1] : '';
}
export async function authenticate(req: Request, env: Env, url: URL): Promise<Principal> {
  const token = decodeToken(req);
  if (!token) fail(401, 'Unauthorized');
  if (env.ADMIN_TOKEN && compareHex(await sha256(token), await sha256(env.ADMIN_TOKEN))) {
    return {kind:'root',role:'admin',id:null,label:'Root administrator',prefix:'/api/'};
  }
  const match=/^efk_([0-9a-f-]{36})_([A-Za-z0-9_-]{40,100})$/.exec(token);
  if (!match) fail(401, 'Unauthorized');
  const row=await first<KeyRow>(env,'SELECT * FROM access_keys WHERE id=?',match[1]);
  if (!row) fail(401, 'Unauthorized');
  if (row.revoked_at || row.expires_at<=now() || !compareHex(await sha256(token),row.secret_hash)) fail(401,'Unauthorized');
  // Boundary-aware scoping: /api/models cannot authorize /api/modelsecrets.
  const scope=row.route_prefix;
  if (!(url.pathname === scope.slice(0,-1) || url.pathname.startsWith(scope))) fail(403,'Credential is not authorized for this resource');
  if (row.role==='viewer' && req.method!=='GET' && req.method!=='HEAD') fail(403,'Read-only credential');
  if (row.role==='operator' && req.method==='DELETE' && !/^\/api\/views\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(url.pathname)) fail(403,'Operator credentials cannot delete resources');
  // Used only for last-use visibility; failures must fail closed, not mask revocation.
  await execute(env,"UPDATE access_keys SET last_used_at=? WHERE id=? AND revoked_at IS NULL AND expires_at>?",now(),row.id,now());
  return {kind:'key',role:row.role,id:row.id,label:row.label,prefix:scope};
}
export async function accessApi(req:Request,env:Env,url:URL,principal:Principal):Promise<Response|null> {
  const p=url.pathname;
  if (p==='/api/access/me' && req.method==='GET') return json({kind:principal.kind,role:principal.role,id:principal.id,label:principal.label,route_prefix:principal.prefix});
  if (!p.startsWith('/api/access/')) return null;
  if (principal.role!=='admin') fail(403,'Only the root administrator may manage credentials');

  if(p==='/api/access/maintenance' && req.method==='GET') {
    const row=await first<{ran_at:string;rows_pruned:number}>(env,
      'SELECT ran_at,rows_pruned FROM maintenance_status WHERE job=?','write-quota');
    return json({schedule:'0 4 * * *',timezone:'UTC',last_run:row?.ran_at??null,rows_pruned:Number(row?.rows_pruned??0),
      retention_hours:24,status:row?'reported':'not_yet_run'});
  }
  if(p==='/api/access/write-quota' && req.method==='GET') {
    const bucket=Math.floor(Date.now()/60000);
    const rows=await first<{active_identities:number;writes:number;root_writes:number}>(env,`SELECT COUNT(*) active_identities,
      COALESCE(SUM(used),0) writes, COALESCE(SUM(CASE WHEN identity='root' THEN used ELSE 0 END),0) root_writes
      FROM api_write_quota WHERE minute_bucket=?`,bucket);
    return json({window_seconds:60,minute_bucket:bucket,root_limit:180,operator_limit:60,
      active_identities:Number(rows?.active_identities??0),writes:Number(rows?.writes??0),root_writes:Number(rows?.root_writes??0),
      note:'Only authenticated mutation attempts are counted. A rejected write consumes quota; reads do not. Best effort operational control, not DDoS protection.'});
  }
  if(p==='/api/access/write-quota/prune' && req.method==='POST') {
    const {cleanupWriteQuota}=await import('./write-quota');
    return json({pruned:await cleanupWriteQuota(env),retention_hours:24});
  }
  if (p==='/api/access/insights' && req.method==='GET') {
    const current=now();
    const inSeven=new Date(Date.now()+7*86400000).toISOString();
    const stale=new Date(Date.now()-30*86400000).toISOString();
    const since=new Date(Date.now()-7*86400000).toISOString();
    const [summary,roleBreakdown,atRisk,mutations]=await Promise.all([
      first<{total:number;active:number;revoked:number;expired:number;expiring:number;never_used:number;dormant:number}>(env,`SELECT COUNT(*) total,
        COALESCE(SUM(CASE WHEN revoked_at IS NULL AND expires_at>? THEN 1 ELSE 0 END),0) active,
        COALESCE(SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END),0) revoked,
        COALESCE(SUM(CASE WHEN revoked_at IS NULL AND expires_at<=? THEN 1 ELSE 0 END),0) expired,
        COALESCE(SUM(CASE WHEN revoked_at IS NULL AND expires_at>? AND expires_at<=? THEN 1 ELSE 0 END),0) expiring,
        COALESCE(SUM(CASE WHEN revoked_at IS NULL AND expires_at>? AND last_used_at IS NULL THEN 1 ELSE 0 END),0) never_used,
        COALESCE(SUM(CASE WHEN revoked_at IS NULL AND expires_at>? AND last_used_at<? THEN 1 ELSE 0 END),0) dormant
        FROM access_keys`,current,current,current,inSeven,current, current,stale),
      list(env,`SELECT role,route_prefix,COUNT(*) total FROM access_keys WHERE revoked_at IS NULL AND expires_at>? GROUP BY role,route_prefix ORDER BY total DESC LIMIT 50`,current),
      list(env,`SELECT id,label,role,route_prefix,expires_at,last_used_at FROM access_keys WHERE revoked_at IS NULL AND expires_at>? AND expires_at<=? ORDER BY expires_at ASC LIMIT 30`,current,inSeven),
      first<{mutations:number;errors:number}>(env,`SELECT COUNT(*) mutations, COALESCE(SUM(CASE WHEN status>=400 THEN 1 ELSE 0 END),0) errors FROM api_activity WHERE created_at>=?`,since)
    ]);
    return json({generated_at:current,expiry_horizon_days:7,stale_usage_days:30,
      credentials:{total:Number(summary?.total||0),active:Number(summary?.active||0),revoked:Number(summary?.revoked||0),expired:Number(summary?.expired||0),expiring:Number(summary?.expiring||0),never_used:Number(summary?.never_used||0),dormant:Number(summary?.dormant||0)},
      active_scopes:roleBreakdown,expiring_keys:atRisk,
      activity_7d:{mutations:Number(mutations?.mutations||0),errors:Number(mutations?.errors||0)},
      limitations:'Root-key administration and route-prefix authorization only. No organizations or tenant isolation, no user SSO, no tamper-evident audit, no read-request telemetry. Counts are observations, not a security guarantee.'});
  }
  if (p==='/api/access/keys' && req.method==='GET') {
    return json({items:await list(env,'SELECT id,label,role,route_prefix,created_at,expires_at,revoked_at,last_used_at FROM access_keys ORDER BY created_at DESC LIMIT 100')});
  }
  if (p==='/api/access/audit' && req.method==='GET') {
    return json({items:await list(env,'SELECT id,action,subject_id,actor_id,detail,created_at FROM access_audit ORDER BY created_at DESC LIMIT 100')});
  }
  if (p==='/api/access/keys' && req.method==='POST') {
    const data=await body(req,12_000);
    if (typeof data.label!=='string' || !data.label.trim() || data.label.length>100) fail(400,'label must be 1-100 characters');
    if (data.role!=='viewer' && data.role!=='operator') fail(400,'role must be viewer or operator');
    const prefix= data.route_prefix===undefined ? '/api/' : data.route_prefix;
    if (typeof prefix!=='string' || !/^\/api\/(?:[a-z0-9-]+\/)*$/i.test(prefix) || prefix.startsWith('/api/access/')) fail(400,'route_prefix must be a canonical /api/.../ route prefix');
    const days=Number(data.expires_in_days ?? 30);
    if (!Number.isInteger(days) || days<1 || days>90) fail(400,'expires_in_days must be an integer from 1 to 90');
    const id=uid();const bytes=crypto.getRandomValues(new Uint8Array(32));
    const secret=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
    const token=`efk_${id}_${secret}`;
    const expires=new Date(Date.now()+days*86400000).toISOString();
    await execute(env,'INSERT INTO access_keys(id,label,role,route_prefix,secret_hash,created_at,expires_at,revoked_at,last_used_at) VALUES(?,?,?,?,?,?,?,NULL,NULL)',id,data.label.trim(),data.role,prefix,await sha256(token),now(),expires);
    await execute(env,'INSERT INTO access_audit(id,action,subject_id,actor_id,detail,created_at) VALUES(?,?,?,?,?,?)',uid(),'issued',id,'root',JSON.stringify({role:data.role,prefix,expires_at:expires}),now());
    return json({id,token,label:data.label.trim(),role:data.role,route_prefix:prefix,expires_at:expires,warning:'Store this credential now: plaintext is displayed only once.'},201);
  }
  const revoke=p.match(/^\/api\/access\/keys\/([0-9a-f-]{36})\/revoke$/);
  if (revoke && req.method==='POST') {
    const row=await first<KeyRow>(env,'SELECT * FROM access_keys WHERE id=?',revoke[1]);
    if (!row) fail(404,'Credential not found');
    if (row.revoked_at) fail(409,'Credential is already revoked');
    const result=await env.DB.prepare('UPDATE access_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(now(),row.id).run();
    if ((result.meta?.changes??0)!==1) fail(409,'Credential was already revoked');
    await execute(env,'INSERT INTO access_audit(id,action,subject_id,actor_id,detail,created_at) VALUES(?,?,?,?,?,?)',uid(),'revoked',row.id,'root',JSON.stringify({label:row.label}),now());
    return json({revoked:true,id:row.id});
  }
  fail(404,'Unknown access management operation');
}

/** Administrative API activity journal. Bounded diagnostic telemetry, NOT tamper-evident auditing. */
import {first,list,json,fail,execute,body,now,type Env} from './core';
import type {Principal} from './access';
export async function recordWrite(env:Env, principal:Principal, req:Request, path:string, status:number, elapsedMs:number, requestId:string):Promise<void>{
 if (!['POST','PUT','PATCH','DELETE'].includes(req.method))return;
 // Never persist credentials, request headers, query strings, or request bodies.
 await execute(env,'INSERT INTO api_activity (id,actor_kind,actor_id,actor_role,method,path,status,duration_ms,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
  requestId,principal.kind,principal.id,principal.role,req.method,path,status,Math.max(0,Math.round(elapsedMs)),now());
}
export async function operationsApi(req:Request,env:Env,url:URL,principal:Principal):Promise<Response|null>{
 if(!url.pathname.startsWith('/api/ops/'))return null;
 if(principal.role!=='admin')fail(403,'Administrator credentials required');
 if(url.pathname==='/api/ops/activity' && req.method==='GET'){
  const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||50));
  const before=url.searchParams.get('before');
  if(before && (!/^\d{4}-\d{2}-\d{2}T/.test(before)||!Number.isFinite(Date.parse(before))))fail(400,'Invalid activity cursor');
  const items= before
   ? await list(env,'SELECT id,actor_kind,actor_id,actor_role,method,path,status,duration_ms,created_at FROM api_activity WHERE created_at < ? ORDER BY created_at DESC,id DESC LIMIT ?',before,limit)
   : await list(env,'SELECT id,actor_kind,actor_id,actor_role,method,path,status,duration_ms,created_at FROM api_activity ORDER BY created_at DESC,id DESC LIMIT ?',limit);
  return json({items,next_before:items.length===limit?(items.at(-1) as {created_at:string}).created_at:null,coverage:'authenticated mutating requests only',limits:{max_page_size:100},note:'Best-effort diagnostic log; not a tamper-evident or compliance-grade audit trail. Failed authentication is not included.'});
 }
 if(url.pathname==='/api/ops/summary' && req.method==='GET'){
  const since=new Date(Date.now()-7*86400000).toISOString();
  const [totals,routes]=await Promise.all([
   first<{n:number;failed:number;avg_ms:number}>(env,'SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END),0) failed,COALESCE(AVG(duration_ms),0) avg_ms FROM api_activity WHERE created_at>=?',since),
   list(env,'SELECT method,path,COUNT(*) total,MAX(created_at) last_seen FROM api_activity WHERE created_at>=? GROUP BY method,path ORDER BY total DESC LIMIT 12',since)
  ]);
  return json({window_days:7,mutations:Number(totals?.n||0),failed:Number(totals?.failed||0),average_duration_ms:Math.round(Number(totals?.avg_ms||0)),top_routes:routes,limitations:'Mutation-only request telemetry; not overall availability, application correctness, or an immutable audit.'});
 }
 if(url.pathname==='/api/ops/prune' && req.method==='POST'){
  const input=await body(req,500);
  if(input.confirm!=='DELETE_OLD_ACTIVITY')fail(400,'Explicit deletion confirmation required');
  const days=Number(input.older_than_days);
  if(!Number.isInteger(days)||days<30||days>3650)fail(400,'older_than_days must be 30-3650');
  const cutoff=new Date(Date.now()-days*86400000).toISOString();
  await execute(env,'DELETE FROM api_activity WHERE created_at < ?',cutoff);
  return json({pruned_before:cutoff,mode:'explicit administrator action'});
 }
 fail(404,'Unknown operations endpoint');
}

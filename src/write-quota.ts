/** Phase 20: atomic D1 write quota. Only credential IDs are stored, never bearer tokens. */
import {HttpError, type Env} from './core';
import type {Principal} from './access';

export const WINDOW_MS=60_000;
export const ROOT_MUTATIONS_PER_MINUTE=180;
export const OPERATOR_MUTATIONS_PER_MINUTE=60;
export function writeQuota(principal:Principal):number {
 return principal.role==='admin'?ROOT_MUTATIONS_PER_MINUTE:principal.role==='operator'?OPERATOR_MUTATIONS_PER_MINUTE:0;
}
export function quotaIdentity(principal:Principal):string {
 return principal.kind==='root'?'root':`key:${principal.id}`;
}
export async function enforceWriteQuota(req:Request,env:Env,principal:Principal,atMs=Date.now()):Promise<void> {
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return;
 const ceiling=writeQuota(principal);
 if(ceiling===0)throw new HttpError(403,'Read-only credential');
 const bucket=Math.floor(atMs/WINDOW_MS);
 const used=await env.DB.prepare(`INSERT INTO api_write_quota(identity,minute_bucket,used)
 VALUES(?,?,1)
 ON CONFLICT(identity,minute_bucket) DO UPDATE SET used=used+1 WHERE used<?`)
 .bind(quotaIdentity(principal),bucket,ceiling).run();
 if(used.meta?.changes!==1){
  const retryAfter=Math.max(1,Math.ceil(((bucket+1)*WINDOW_MS-atMs)/1000));
  throw new HttpError(429,'Write quota exceeded. Retry after the current minute.',retryAfter);
 }
}
export async function cleanupWriteQuota(env:Env,atMs=Date.now()):Promise<number> {
 const cutoff=Math.floor(atMs/WINDOW_MS)-1440;
 const result=await env.DB.prepare('DELETE FROM api_write_quota WHERE minute_bucket<?').bind(cutoff).run();
 return Number(result.meta?.changes??0);
}

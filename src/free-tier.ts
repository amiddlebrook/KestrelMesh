/** Shared free-only infrastructure policy, not shared product business logic. */
import {HttpError, type Env} from './core';

// Conservative per-application limits. Provider account quotas are shared across projects.
export const API_REQUESTS_PER_DAY = 1200;
export const AI_CALLS_PER_DAY = 4;
export const FREE_TIER_ONLY = true;
const DAY_MS = 86_400_000;
export type BudgetKind = 'api' | 'ai';
export const dayBucket = (atMs=Date.now()) => Math.floor(atMs/DAY_MS);
export const retryAtMidnight = (atMs=Date.now()) => Math.max(1,Math.ceil(((dayBucket(atMs)+1)*DAY_MS-atMs)/1000));
export function aiEnabled(env:Env):boolean {return env.FREE_AI_ENABLED==='true';}
export async function reserveBudget(env:Env,kind:BudgetKind,limit:number,atMs=Date.now()):Promise<void>{
 const reserved=await env.DB.prepare(`INSERT INTO free_tier_budget(kind,day_bucket,used)
 VALUES(?,?,1)
 ON CONFLICT(kind,day_bucket) DO UPDATE SET used=used+1 WHERE used<?`)
 .bind(kind,dayBucket(atMs),limit).run();
 if(reserved.meta?.changes!==1)throw new HttpError(429,`Free daily ${kind} budget exhausted. Resets at 00:00 UTC.`,retryAtMidnight(atMs));
}
export async function reserveFreeAI(env:Env,atMs=Date.now()):Promise<void>{
 if(!aiEnabled(env))throw new HttpError(503,'Remote AI is disabled by the zero-cost policy. Deterministic tools remain available.');
 await reserveBudget(env,'ai',AI_CALLS_PER_DAY,atMs);
}
export async function budgetStatus(env:Env,atMs=Date.now()){
 const rows=await env.DB.prepare('SELECT kind,used FROM free_tier_budget WHERE day_bucket=?').bind(dayBucket(atMs)).all<{kind:BudgetKind;used:number}>();
 const counts=Object.fromEntries(rows.results.map(r=>[r.kind,Number(r.used)]));
 return {
  mode:'free-only',paid_services_required:false,remote_ai_enabled:aiEnabled(env),
  reset_at:new Date((dayBucket(atMs)+1)*DAY_MS).toISOString(),
  requests:{used:counts.api||0,limit:API_REQUESTS_PER_DAY,remaining:Math.max(0,API_REQUESTS_PER_DAY-(counts.api||0))},
  ai:{used:counts.ai||0,limit:AI_CALLS_PER_DAY,remaining:Math.max(0,AI_CALLS_PER_DAY-(counts.ai||0))},
  account_quotas_shared:true,
  caveat:'Application budgets are not proof of Cloudflare plan type or the absence of usage by other Workers; the Cloudflare account must remain on Workers Free.'
 };
}
export async function cleanupBudget(env:Env,atMs=Date.now()):Promise<number>{
 const removed=await env.DB.prepare('DELETE FROM free_tier_budget WHERE day_bucket<?').bind(dayBucket(atMs)-7).run();
 return Number(removed.meta?.changes??0);
}

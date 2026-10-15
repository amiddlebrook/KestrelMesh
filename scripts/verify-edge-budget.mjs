/** Small, bounded production availability/latency sample, not a load or SLA claim. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const origin=process.env.DEPLOY_URL;
assert.ok(origin&&origin.startsWith('https://'),'DEPLOY_URL must be an HTTPS deployment URL');
const url=new URL('/api/health',origin);
const REQUESTS=24,CONCURRENCY=4,DEADLINE_MS=10_000,P95_LIMIT_MS=8_000;
const durations=[];
const failures=[];
let next=0;
async function worker(){
 while(next<REQUESTS){
  const i=next++;
  const t=performance.now();
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(DEADLINE_MS),redirect:'error',headers:{Accept:'application/json','Cache-Control':'no-cache'}});
   if(response.status!==200)throw new Error(`HTTP ${response.status}`);
   const payload=await response.json();
   if(payload?.ok!==true)throw new Error('missing healthy response');
   durations.push(performance.now()-t);
  }catch(error){failures.push({index:i,reason:String(error?.message??error)});}
 }
}
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));
durations.sort((a,b)=>a-b);
const percentile=(p)=>durations.length?Math.ceil(durations[Math.max(0,Math.ceil(p*durations.length)-1)]):null;
const report={endpoint:url.href,mode:'bounded-non-destructive-health-probe',requests:REQUESTS,concurrency:CONCURRENCY,failures:failures.length,successes:durations.length,p50_ms:percentile(.5),p95_ms:percentile(.95),p99_ms:percentile(.99),p95_limit_ms:P95_LIMIT_MS,note:'24 read-only health checks cannot establish steady-state load capacity, tail latency SLO, rate-limit safety, or an enterprise SLA.'};
console.log(JSON.stringify(report));
assert.equal(failures.length,0,`Health probes failed: ${JSON.stringify(failures.slice(0,5))}`);
assert.ok(report.p95_ms<=P95_LIMIT_MS,`p95 latency exceeded ${P95_LIMIT_MS} ms`);

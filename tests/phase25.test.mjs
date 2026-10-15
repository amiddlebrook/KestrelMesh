import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {reserveBudget,reserveFreeAI,budgetStatus,dayBucket,API_REQUESTS_PER_DAY,AI_CALLS_PER_DAY,retryAtMidnight,cleanupBudget}=require('./.compiled/free-tier.js');
const {generate}=require('./.compiled/core.js');
const worker=require('./.compiled/index.js').default;
const origin='https://app.example.workers.dev';
function fixture() {
 const db=new DatabaseSync(':memory:');
 for(const m of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+m,'utf8'));
 let invoked=0;
 const env={ADMIN_TOKEN:'cost-policy-test-root-secret',FREE_AI_ENABLED:'false',DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}}, AI:{async run(){invoked++;return{response:'Synthetic AI response'}}}};
 return{db,env,get invoked(){return invoked}};
}
async function req(env,path,token=env.ADMIN_TOKEN){const res=await worker.fetch(new Request(origin+path,{headers:token?{Authorization:`Bearer ${token}`}:{}}),env);return {status:res.status,data:await res.json(),headers:res.headers}};
test('Phase 25: UTC midnight rollover and atomic budget exhaustion',async()=>{
 const f=fixture();try {
  const ms=Date.parse('2026-10-15T23:59:59.000Z');
  assert.equal(dayBucket(ms+1000),dayBucket(ms)+1);
  assert.equal(retryAtMidnight(ms),1);
  await reserveBudget(f.env,'api',2,ms);await reserveBudget(f.env,'api',2,ms);
  await assert.rejects(()=>reserveBudget(f.env,'api',2,ms),e=>e.status===429&&e.retryAfter===1);
  await reserveBudget(f.env,'api',2,ms+1000);
  const before=await budgetStatus(f.env,ms);assert.equal(before.requests.used,2);
  const after=await budgetStatus(f.env,ms+1000);assert.equal(after.requests.used,1);
  assert.equal(after.requests.limit,API_REQUESTS_PER_DAY);
 }finally{f.db.close()}
});
test('Phase 25: remote AI is opt-in and limited without a paid fallback',async()=>{
 const f=fixture();try{
  await assert.rejects(()=>generate(f.env,'system','test',32),e=>e.status===503&&/disabled/i.test(e.message));
  assert.equal(f.invoked,0,'No external inference request may run while zero-cost mode is off');
  f.env.FREE_AI_ENABLED='true';
  for(let i=0;i<AI_CALLS_PER_DAY;i++)assert.equal(await generate(f.env,'system','test',32),'Synthetic AI response');
  assert.equal(f.invoked,AI_CALLS_PER_DAY);
  await assert.rejects(()=>generate(f.env,'system','test',32),e=>e.status===429);
  assert.equal(f.invoked,AI_CALLS_PER_DAY,'AI provider must not be called after cap');
 }finally{f.db.close()}
});
test('Phase 25: protected budget status requires authorization and reports opt-in',async()=>{
 const f=fixture();try{
  assert.equal((await req(f.env,'/api/free-tier/status','')).status,401);
  const authenticated=await req(f.env,'/api/free-tier/status');
  assert.equal(authenticated.status,200);
  assert.equal(authenticated.data.mode,'free-only');
  assert.equal(authenticated.data.paid_services_required,false);
  assert.equal(authenticated.data.remote_ai_enabled,false);
  assert.equal(authenticated.data.ai.limit,AI_CALLS_PER_DAY);
  assert.equal(authenticated.data.requests.limit,API_REQUESTS_PER_DAY);
  assert.equal(authenticated.data.account_quotas_shared,true);
  assert.equal(authenticated.headers.get('cache-control'),'no-store');
 }finally{f.db.close()}
});
test('Phase 25: stale quota rows pruned, current budget preserved',async()=>{
 const f=fixture();try{
  const at=Date.parse('2026-10-15T12:00:00Z');
  await reserveBudget(f.env,'ai',AI_CALLS_PER_DAY,at-9*86400000);
  await reserveBudget(f.env,'ai',AI_CALLS_PER_DAY,at);
  assert.equal(await cleanupBudget(f.env,at),1);
  assert.equal((await budgetStatus(f.env,at)).ai.used,1);
 }finally{f.db.close()}
});

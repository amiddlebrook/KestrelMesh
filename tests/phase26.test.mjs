import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const app=require('./.compiled/index.js');
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const name of readdirSync('migrations').filter(s=>s.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+name,'utf8'));
 let aiCalls=0;
 const env={ADMIN_TOKEN:'phase26-fixture-root-secret',FREE_AI_ENABLED:'false',DB:{prepare(sql){let args=[];return{bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){const x=db.prepare(sql).run(...args);return{meta:{changes:x.changes}}}}}},AI:{async run(){aiCalls++;return{response:'AI should not be invoked'}}}};
 return {db,env,get aiCalls(){return aiCalls},close(){db.close()}};
}
async function call(f,path,payload,method){const url=new URL('http://localhost:8787'+path);const req=new Request(url,{method:method||(payload===undefined?'GET':'POST'),headers:payload===undefined?{}:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});return app.api(req,f.env,url).then(async res=>({status:res.status,data:await res.json()}));}
async function rejects(f,path,payload,status,method){await assert.rejects(()=>call(f,path,payload,method),e=>e.status===status)}
test('routing fallback plan skips unhealthy models and performs zero inference',async()=>{
 const f=fixture();try{
 const fixtureModel=(await call(f,'/api/models',{name:'Local deterministic',provider:'fixture',priority:20})).data;
 const aiModel=(await call(f,'/api/models',{name:'Free Workers AI',provider:'workers_ai',model_ref:'@cf/meta/llama-3.1-8b-instruct',priority:1})).data;
 const openAt=new Date(Date.now()+60000).toISOString();
 f.db.prepare('INSERT INTO circuit_breakers(model_id,state,consecutive_failures,opened_until,updated_at) VALUES(?,?,?,?,?)').run(aiModel.id,'open',3,openAt,new Date().toISOString());
 const plan=(await call(f,'/api/route-plan',{task:'classify billing request',max_candidates:4})).data;
 assert.equal(plan.candidates.length,1);assert.equal(plan.candidates[0].id,fixtureModel.id);
 assert.ok(plan.excluded_circuit_models.includes(aiModel.id));assert.equal(plan.inference_calls,0);assert.equal(f.aiCalls,0);
 await rejects(f,'/api/route-plan',{task:'x',max_candidates:99},400);
 }finally{f.close()}
});

test('free-only routing falls back to local fixtures when remote AI is disabled',async()=>{
 const f=fixture();try{
  const local=(await call(f,'/api/models',{name:'Local free',provider:'fixture',priority:50})).data;
  const remote=(await call(f,'/api/models',{name:'Remote AI disabled',provider:'workers_ai',model_ref:'@cf/meta/llama-3.1-8b-instruct',priority:1})).data;
  const preview=(await call(f,'/api/route-preview',{task:'billing'})).data;assert.equal(preview.model.id,local.id);
  const plan=(await call(f,'/api/route-plan',{task:'billing'})).data;assert.equal(plan.candidates.length,1);assert.ok(plan.excluded_remote_ai_models.includes(remote.id));
  const result=(await call(f,'/api/infer',{task:'billing'})).data;assert.match(result.response,/DEMO FIXTURE/);assert.equal(f.aiCalls,0);
 }finally{f.close()}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {decisionApi}=require('./.compiled/decision.js');
function fixture(){const db=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+name,'utf8'));const env={DB:{prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}}};return {db,env}}
async function request(env,path,method='GET',data){const req=new Request('http://localhost:8787'+path,{method,headers:method==='POST'?{'content-type':'application/json'}:{},body:method==='POST'?JSON.stringify(data):undefined});return decisionApi(req,env,new URL(req.url))}
const {evaluateWindow}=require('./.compiled/decision.js');
test('availability and percentile require evidence; thresholds cannot pass with small samples',()=>{const sample=Array.from({length:9},(_,i)=>({model_id:'m',status:'completed',latency_ms:i*10,cache_hit:0,created_at:'2026-01-01'}));const x=evaluateWindow(sample,99,900);assert.equal(x.insufficient_samples,true);assert.equal(x.meets_target,false);assert.equal(x.p95_ms,80);const y=evaluateWindow([...sample,...sample],99,900);assert.equal(y.meets_target,true)});
test('provider objectives persist and report actual request history',async()=>{const {db,env}=fixture();try{db.exec(`INSERT INTO models VALUES('m','Model 1','fixture','fixture',10,1,'2026-01-01');`);assert.equal((await request(env,'/api/decision/objectives','POST',{model_id:'m',target_pct:99,p95_target_ms:250})).status,200);const data=await (await request(env,'/api/decision/objectives')).json();assert.equal(data.models[0].objective.target_pct,99);assert.equal(data.models[0].observation.insufficient_samples,true);await assert.rejects(request(env,'/api/decision/objectives','POST',{model_id:'m',target_pct:2,p95_target_ms:10}),/90/)}finally{db.close()}});

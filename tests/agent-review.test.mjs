import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {agentReviewApi}=require('./.compiled/agent-review.js');
const {agentApi}=require('./.compiled/agent.js');
function fixture(){const db=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
const env={DB:{prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}}};return {db,env}}
const root={kind:'root',role:'admin',id:null,label:'Test administrator',prefix:'/api/'};
const viewer={kind:'key',role:'viewer',id:'demo',label:'Observer',prefix:'/api/'};
async function request(env,path,method='GET',input,principal=root){const req=new Request('http://localhost:8787'+path,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify(input):undefined});const url=new URL(req.url);return path.endsWith('dossier')||path.endsWith('review')?agentReviewApi(req,env,url,principal):agentApi(req,env,url)}
test('operator reviews require administrator, terminal session, and meaningful justification',async()=>{const {db,env}=fixture();try{const session=await (await request(env,'/api/agents','POST',{objective:'Review recent evidence'})).json();const path=`/api/agents/${session.id}/review`;
await assert.rejects(request(env,path,'POST',{verdict:'accepted',note:'Seems appropriate based on evidence'},viewer),/root administrator/);
await assert.rejects(request(env,path,'POST',{verdict:'accepted',note:'Seems appropriate based on evidence'}),/completed or stopped/);
await env.DB.prepare("UPDATE agent_sessions SET status='completed',answer='Documented conclusion' WHERE id=?").bind(session.id).run();
await assert.rejects(request(env,path,'POST',{verdict:'accepted',note:'tiny'}),/justification/);
const response=await request(env,path,'POST',{verdict:'accepted',note:'Reviewed observed records and limitations thoroughly.'});assert.equal(response.status,201);
await assert.rejects(request(env,path,'POST',{verdict:'rejected',note:'Contradicted by additional source records'}),/immutable review already exists/);
const read=await (await request(env,path)).json();assert.equal(read.review.verdict,'accepted');
}finally{db.close()}});
test('evidence dossier includes ordered trace, immutable review and deterministic SHA-256 digest',async()=>{const {db,env}=fixture();try{const session=await (await request(env,'/api/agents','POST',{objective:'Inspect recent observations'})).json();const path=`/api/agents/${session.id}`;
await env.DB.prepare("UPDATE agent_sessions SET status='needs_review' WHERE id=?").bind(session.id).run();
await request(env,path+'/review','POST',{verdict:'requires_followup',note:'Additional input observations are necessary.'});
const a=await (await request(env,path+'/dossier')).json();const b=await (await request(env,path+'/dossier')).json();assert.equal(a.kind,'agent_evidence_dossier');assert.equal(a.sha256,b.sha256);assert.equal(a.sha256.length,64);assert.equal(a.review.verdict,'requires_followup');assert.deepEqual(a.events,[]);
await assert.rejects(request(env,path+'/review','POST',{verdict:'accepted',note:'Not completed but accept it anyhow.'}),/Unfinished or failed reasoning cannot be accepted/);
}finally{db.close()}});

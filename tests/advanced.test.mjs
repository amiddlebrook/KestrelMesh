import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const app=require('./.compiled/index.js');
const advanced=require('./.compiled/advanced.js');
function env(){
 const sql=new DatabaseSync(':memory:');
 for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('migrations/'+f,'utf8'));
 return { sql,DB:{prepare(query){let args=[];return {bind(...x){args=x;return this},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)??null},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:r.changes}}}}}},FREE_AI_ENABLED:'true',AI:{async run(){return {response:'Fixture test response'}}},stop(){sql.close()}};
}
async function call(e,path,data,method){const request=new Request('http://localhost:8787'+path,{method:method||(data===undefined?'GET':'POST'),headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const response=await app.api(request,e,new URL(request.url));assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json()}
async function rejection(e,path,data,status=400){const request=new Request('http://localhost:8787'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});await assert.rejects(()=>app.api(request,e,new URL(request.url)),err=>err.status===status)}
test('circuit breakers isolate repeated provider failures and recover',async()=>{
 const e=env();try{const m=await call(e,'/api/models',{name:'Test fixture',provider:'fixture',priority:1});
 for(let i=0;i<3;i++)await advanced.recordCircuit(e,m.id,false);
 let current=await call(e,'/api/circuits');assert.equal(current.items[0].effective_state,'open');
 assert.ok((await advanced.disabledByCircuit(e)).has(m.id));
 await rejection(e,'/api/infer',{task:'hello'},409);
 const restored=await call(e,`/api/circuits/${m.id}/reset`,{});assert.equal(restored.state,'closed');
 const response=await call(e,'/api/infer',{task:'hello'});assert.match(response.response,/DEMO FIXTURE/);
 const events=await call(e,'/api/circuit-events');assert.ok(events.items.length>=2);
 }finally{e.stop()}
});

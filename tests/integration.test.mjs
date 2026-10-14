import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const app=name=>require(resolve(`tests/.compiled/index.js`));
function environment(name){
  const sql=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('migrations/'+file,'utf8'));
  return {DB:{prepare(query){let args=[];return {bind(...v){args=v;return this}, async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)??null},async run(){const out=sql.prepare(query).run(...args);return {meta:{changes:out.changes}}}}}},
    AI:{async run(){return {response:'Synthetic test adapter answer. No live AI requests.'}}},stop(){sql.close()}};
}
function req(path,body){return new Request('http://localhost:8787'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
async function call(name,env,path,data,method){const request=new Request('http://localhost:8787'+path,{method:method||((data===undefined)?'GET':'POST'),headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const response=await app(name).api(request,env,new URL(request.url));if(response.status<200||response.status>=300)throw new Error(`${name} ${path} HTTP ${response.status}: ${await response.text()}`);return response.json()}

test('KestrelMesh: fixture routing generates result and records cache hit',async()=>{
 const env=environment('kestrelmesh');try{
  await call('kestrelmesh',env,'/api/seed',{});
  const first=await call('kestrelmesh',env,'/api/infer',{task:'hello from test'});assert.equal(first.cache_hit,false);
  const second=await call('kestrelmesh',env,'/api/infer',{task:'hello from test'});assert.equal(second.cache_hit,true);
  const metrics=await call('kestrelmesh',env,'/api/metrics');assert.equal(metrics.sample,2);assert.equal(metrics.cache_hit_rate,50);
 }finally{env.stop()}
});

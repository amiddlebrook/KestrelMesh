import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
function setup(){const db=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));const env={ADMIN_TOKEN:'local-private-token',DB:{prepare(sql){let params=[];return{bind(...v){params=v;return this},async first(){return db.prepare(sql).get(...params)??null},async all(){return {results:db.prepare(sql).all(...params)}},async run(){const r=db.prepare(sql).run(...params);return{meta:{changes:r.changes}}}}}}};return{db,env}}
test('public API rejects unauthorized access, accepts configured admin and exposes only health',async()=>{
 const {db,env}=setup();try{
  const origin='https://portfolio-test.workers.dev';
  const health=await worker.fetch(new Request(origin+'/api/health'),env);assert.equal(health.status,200);
  const missing=await worker.fetch(new Request(origin+'/api/overview'),env);assert.equal(missing.status,401);
  const incorrect=await worker.fetch(new Request(origin+'/api/overview',{headers:{Authorization:'Bearer wrong'}}),env);assert.equal(incorrect.status,401);
  const authorized=await worker.fetch(new Request(origin+'/api/overview',{headers:{Authorization:'Bearer local-private-token'}}),env);assert.equal(authorized.status,200);
  const disabled=await worker.fetch(new Request(origin+'/api/overview'),{...env,ADMIN_TOKEN:undefined});assert.equal(disabled.status,503);
 }finally{db.close()}
});

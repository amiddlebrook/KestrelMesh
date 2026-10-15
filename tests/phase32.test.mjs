import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const base='https://portfolio-kestrelmesh.workers.dev';
const root='phase32-administrator-secret-testing';
const migrations=readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort();
function fixture(otherApp=null){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  if(otherApp){
    db.exec('CREATE TABLE app_workspace_binding(slot INTEGER PRIMARY KEY,app_name TEXT NOT NULL,worker_name TEXT NOT NULL,database_name TEXT NOT NULL,policy TEXT NOT NULL,created_at TEXT NOT NULL)');
    db.prepare('INSERT INTO app_workspace_binding VALUES(1,?,?,?,?,?)').run(otherApp,'portfolio-'+otherApp.toLowerCase(),'portfolio-'+otherApp.toLowerCase()+'-db','single-workspace','2026-10-15T00:00:00Z');
  }
  for(const name of migrations)db.exec(readFileSync('migrations/'+name,'utf8'));
  const env={ADMIN_TOKEN:root,DB:{prepare(sql){let params=[];return{
    bind(...v){params=v;return this},
    async first(){return db.prepare(sql).get(...params)??null},
    async all(){return {results:db.prepare(sql).all(...params)}},
    async run(){let value=db.prepare(sql).run(...params);return {meta:{changes:value.changes}}}
  }}}};
  return {db,env};
}
async function call(env,path,token=root){
  return worker.fetch(new Request(base+path,{headers:{Authorization:'Bearer '+token}}),env);
}
test('KestrelMesh: correct D1 identity permits a protected, admin-only boundary report',async()=>{
  const {db,env}=fixture();try{
    const r=await call(env,'/api/access/workspace');assert.equal(r.status,200);
    const body=await r.json();
    assert.deepEqual([body.app,body.worker,body.database,body.mode,body.multitenant,body.verified],
      ['KestrelMesh','portfolio-kestrelmesh','portfolio-kestrelmesh-db','single-workspace',false,true]);
    assert.equal((await call(env,'/api/access/workspace','wrong-token')).status,401);
    assert.equal((await call(env,'/api/overview')).status,200);
    assert.throws(()=>db.exec("UPDATE app_workspace_binding SET database_name='other'"),/immutable/i);
    assert.throws(()=>db.exec('DELETE FROM app_workspace_binding'),/immutable/i);
  }finally{db.close()}
});
test('KestrelMesh: cross-bound database fails closed before private reads and writes',async()=>{
  const {db,env}=fixture('AnotherApplication');try{
    assert.equal(db.prepare('SELECT app_name FROM app_workspace_binding').get().app_name,'AnotherApplication', 'Migration must not repair wrong D1 binding');
    for(const url of ['/api/overview','/api/access/workspace','/api/workflows']){
      const response=await call(env,url);
      assert.equal(response.status,503,`Wrong database leaked access to ${url}`);
      assert.match((await response.json()).error,/Workspace database binding mismatch/);
    }
    assert.equal(db.prepare('SELECT COUNT(*) n FROM access_keys').get().n,0);
  }finally{db.close()}
});
test('KestrelMesh: missing binding schema fails closed; public health remains available',async()=>{
  const {db,env}=fixture();try{
    db.exec('DROP TRIGGER app_workspace_binding_block_update; DROP TRIGGER app_workspace_binding_block_delete; DROP TABLE app_workspace_binding;');
    const response=await call(env,'/api/overview');assert.equal(response.status,503);
    assert.match((await response.json()).error,/binding unavailable/);
    const health=await worker.fetch(new Request(base+'/api/health'),env);assert.equal(health.status,200);
  }finally{db.close()}
});
test('KestrelMesh: scheduled database maintenance refuses mismatched binding',async()=>{
  const {db,env}=fixture('AnotherApplication');try{
    await assert.rejects(()=>worker.scheduled({cron:'0 4 * * *'},env),/Workspace database binding mismatch/);
  }finally{db.close()}
});

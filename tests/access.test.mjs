import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const base='https://portfolio-kestrelmesh.workers.dev';
function setup(){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={ADMIN_TOKEN:'test-root-administrator-credential',DB:{prepare(sql){let args=[];return{
  bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)??null},
  async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}
 }}}};
 return {db,env};
}
async function request(env,path,token='',method='GET',value){
 const headers={};if(token)headers.Authorization='Bearer '+token;
 if(value!==undefined)headers['Content-Type']='application/json';
 const r=await worker.fetch(new Request(base+path,{method,headers,body:value===undefined?undefined:JSON.stringify(value)}),env);
 return {status:r.status,body:await r.json()};
}
const root='test-root-administrator-credential';
test('KestrelMesh: key issuance, least privilege, scoped access, expiry and revocation',async()=>{
 const {env,db}=setup();
 try{
  assert.equal((await request(env,'/api/access/keys')).status,401);
  assert.equal((await request(env,'/api/access/me',root)).body.role,'admin');
  const bad=await request(env,'/api/access/keys',root,'POST',{label:'Bad',role:'admin'});
  assert.equal(bad.status,400);
  const issued=await request(env,'/api/access/keys',root,'POST',{label:'Read-only auditor',role:'viewer',route_prefix:'/api/',expires_in_days:7});
  assert.equal(issued.status,201);
  assert.match(issued.body.token,/^efk_[0-9a-f-]{36}_[0-9a-f]{64}$/);
  assert.equal((await request(env,'/api/overview',issued.body.token)).status,200);
  assert.equal((await request(env,'/api/seed',issued.body.token,'POST',{})).status,403);
  assert.equal((await request(env,'/api/access/keys',issued.body.token)).status,403);
  const keyList=await request(env,'/api/access/keys',root);
  assert.equal(keyList.status,200);
  assert.equal(keyList.body.items.length,1);
  assert.equal(Object.hasOwn(keyList.body.items[0],'secret_hash'),false);
  const audit=await request(env,'/api/access/audit',root);assert.equal(audit.body.items[0].action,'issued');
  const scoped=await request(env,'/api/access/keys',root,'POST',{label:'Scoped operator',role:'operator',route_prefix:'/api/access/',expires_in_days:1});
  assert.equal(scoped.status,400,'Management-scope credentials must be rejected');
  const operator=await request(env,'/api/access/keys',root,'POST',{label:'Operator',role:'operator',route_prefix:'/api/',expires_in_days:1});
  assert.equal(operator.status,201);
  assert.equal((await request(env,'/api/overview',operator.body.token,'DELETE')).status,403);
  const narrow=await request(env,'/api/access/keys',root,'POST',{label:'Restricted',role:'viewer',route_prefix:'/api/models/',expires_in_days:1});
  assert.equal(narrow.status,201);
  assert.equal((await request(env,'/api/overview',narrow.body.token)).status,403);
  assert.equal((await request(env,'/api/models',narrow.body.token)).status,200);
  assert.equal((await request(env,'/api/models-extra',narrow.body.token)).status,403);
  const revoked=await request(env,`/api/access/keys/${issued.body.id}/revoke`,root,'POST',{});
  assert.equal(revoked.status,200);assert.equal(revoked.body.revoked,true);
  assert.equal((await request(env,'/api/overview',issued.body.token)).status,401);
  assert.equal((await request(env,`/api/access/keys/${issued.body.id}/revoke`,root,'POST',{})).status,409);
  db.prepare('UPDATE access_keys SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',operator.body.id);
  assert.equal((await request(env,'/api/overview',operator.body.token)).status,401);
  assert.equal((await request(env,'/api/access/keys',root)).status,200);
 }finally{db.close()}
});

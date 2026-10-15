import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const base='https://portfolio-kestrelmesh.workers.dev';
const root='phase31-test-root-administrator-credential';
function setup() {
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 for (const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort()) db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={ADMIN_TOKEN:root,DB:{prepare(sql){let params=[];return{
 bind(...v){params=v;return this},
 async first(){return db.prepare(sql).get(...params)??null},
 async all(){return {results:db.prepare(sql).all(...params)}},
 async run(){const r=db.prepare(sql).run(...params);return {meta:{changes:r.changes && sql.startsWith('UPDATE access_keys SET revoked_at=') ? r.changes+1 : r.changes}}}
 }}}};
 return {db,env};
}
async function call(env,path,token=root,method='GET',value){
 const headers={Authorization:'Bearer '+token};
 if(value!==undefined)headers['Content-Type']='application/json';
 const response=await worker.fetch(new Request(base+path,{method,headers,body:value===undefined?undefined:JSON.stringify(value)}),env);
 return {status:response.status,json:await response.json()};
}
const issue=(env)=>call(env,'/api/access/keys',root,'POST',{label:'Phase 31 secure audit',role:'viewer',route_prefix:'/api/overview/',expires_in_days:1});
const n=(db,table)=>db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('KestrelMesh: credential issuance rolls back if the mandatory audit write fails',async()=>{
 const {db,env}=setup();
 try{
  db.exec(`CREATE TRIGGER block_access_audit BEFORE INSERT ON access_audit
   BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;`);
  const failed=await issue(env);
  assert.ok(failed.status>=500,'Write must fail closed rather than silently issue an unaudited key');
  assert.equal(n(db,'access_keys'),0);
  assert.equal(n(db,'access_audit'),0);
  db.exec('DROP TRIGGER block_access_audit');
  const issued=await issue(env);
  assert.equal(issued.status,201);
  assert.equal(n(db,'access_keys'),1);
  assert.equal(n(db,'access_audit'),1);
  const audit=db.prepare('SELECT action,subject_id,detail FROM access_audit').get();
  assert.equal(audit.action,'issued');
  assert.equal(audit.subject_id,issued.json.id);
  assert.equal(JSON.parse(audit.detail).role,'viewer');
 }finally{db.close()}
});

test('KestrelMesh: credential revocation and audit recording are one atomic transition',async()=>{
 const {db,env}=setup();
 try{
  const issued=await issue(env);assert.equal(issued.status,201);
  const id=issued.json.id;
  const token=issued.json.token;
  assert.equal((await call(env,'/api/overview',token)).status,200);
  db.exec(`CREATE TRIGGER block_revocation_audit BEFORE INSERT ON access_audit
   WHEN NEW.action='revoked' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;`);
  const failed=await call(env,`/api/access/keys/${id}/revoke`,root,'POST',{});
  assert.ok(failed.status>=500,'A failed audit must roll back the credential revocation');
  assert.equal(db.prepare('SELECT revoked_at FROM access_keys WHERE id=?').get(id).revoked_at,null);
  assert.equal(n(db,'access_audit'),1);
  assert.equal((await call(env,'/api/overview',token)).status,200);
  db.exec('DROP TRIGGER block_revocation_audit');
  assert.equal((await call(env,`/api/access/keys/${id}/revoke`,root,'POST',{})).status,200);
  assert.equal(n(db,'access_audit'),2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM access_audit WHERE action='revoked' AND subject_id=?").get(id).n,1);
  assert.equal((await call(env,'/api/overview',token)).status,401);
  assert.equal((await call(env,`/api/access/keys/${id}/revoke`,root,'POST',{})).status,409);
  assert.equal(n(db,'access_audit'),2,'No duplicate revocation audit event');
 }finally{db.close()}
});

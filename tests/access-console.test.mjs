import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {classifyKey,filterKeys,expiryPct,scopeClass,policyPreset} from '../public/access-console.js';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const base='https://security.example.workers.dev';
const ROOT='test-root-administrator-credential';
function setup(){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={ADMIN_TOKEN:ROOT,DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return{meta:{changes:r.changes}}}}}}};
 return {env,db};
}
async function req(env,path,token='',method='GET',data){
 const headers={};if(token)headers.Authorization=`Bearer ${token}`;
 if(data!==undefined)headers['Content-Type']='application/json';
 const r=await worker.fetch(new Request(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)}),env);
 return {status:r.status,body:await r.json()};
}
test('Phase 14: root-only insights correctly classify lifecycle without leaking secret hashes',async()=>{
 const {db,env}=setup();
 try {
  assert.equal((await req(env,'/api/access/insights')).status,401);
  let result=await req(env,'/api/access/insights',ROOT);
  assert.equal(result.status,200);assert.equal(result.body.credentials.active,0);
  assert.equal(result.body.activity_7d.mutations,0);
  const first=await req(env,'/api/access/keys',ROOT,'POST',{label:'QA viewer',role:'viewer',route_prefix:'/api/',expires_in_days:7});
  assert.equal(first.status,201);
  const second=await req(env,'/api/access/keys',ROOT,'POST',{label:'Ops operator',role:'operator',route_prefix:'/api/workflows/',expires_in_days:30});
  assert.equal(second.status,201);
  result=await req(env,'/api/access/insights',ROOT);
  assert.equal(result.status,200);
  assert.equal(result.body.credentials.total,2);assert.equal(result.body.credentials.active,2);
  assert.equal(result.body.credentials.never_used,2);assert.equal(result.body.credentials.expiring,1);
  assert.equal(result.body.active_scopes.length,2);assert.equal(result.body.expiring_keys.length,1);
  assert.equal(result.body.expiring_keys[0].label,'QA viewer');
  assert.equal(JSON.stringify(result.body).includes('secret_hash'),false);
  assert.equal(JSON.stringify(result.body).includes(first.body.token),false);
  assert.equal((await req(env,'/api/access/insights',first.body.token)).status,403);
  db.prepare('UPDATE access_keys SET expires_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z',second.body.id);
  await req(env,`/api/access/keys/${first.body.id}/revoke`,ROOT,'POST',{});
  result=await req(env,'/api/access/insights',ROOT);
  assert.equal(result.body.credentials.total,2);assert.equal(result.body.credentials.active,0);
  assert.equal(result.body.credentials.revoked,1);assert.equal(result.body.credentials.expired,1);
  assert.equal(result.body.expiring_keys.length,0);
 }finally{db.close()}
});
test('Phase 14: pure access UI calculations handle lifecycle, special text and allowlisted presets',()=>{
 const n=Date.parse('2026-10-15T00:00:00.000Z');
 const rows=[
  {id:'a',label:'Engineer <script>',role:'viewer',route_prefix:'/api/',created_at:'2026-10-01T00:00:00.000Z',expires_at:'2026-11-01T00:00:00.000Z',revoked_at:null},
  {id:'b',label:'Revoked',role:'operator',route_prefix:'/api/models/',created_at:'2026-10-01T00:00:00.000Z',expires_at:'2026-11-01T00:00:00.000Z',revoked_at:'2026-10-09T00:00:00.000Z'},
  {id:'c',label:'About to expire',role:'viewer',route_prefix:'/api/',created_at:'2026-10-14T00:00:00.000Z',expires_at:'2026-10-17T00:00:00.000Z',revoked_at:null},
  {id:'d',label:'Old',role:'viewer',route_prefix:'/api/',created_at:'2026-10-01T00:00:00.000Z',expires_at:'2026-10-12T00:00:00.000Z',revoked_at:null}
 ];
 assert.deepEqual(rows.map(x=>classifyKey(x,n)),['active','revoked','expiring','expired']);
 assert.equal(filterKeys(rows,{view:'expiring'},n).length,1);
 assert.equal(filterKeys(rows,{query:'script'},n).length,1);
 assert.equal(filterKeys(rows,{query:'models',view:'revoked'},n).length,1);
 assert.equal(expiryPct(rows[1],n)>0,true);
 assert.equal(expiryPct(rows[3],n),0);
 assert.equal(scopeClass('/api/'),'Wide access');
 assert.equal(scopeClass('/api/models/'),'Route-limited');
 assert.equal(policyPreset('readonly').role,'viewer');
 assert.equal(policyPreset('operator').expires_in_days,1);
 assert.equal(policyPreset('other'),null);
});

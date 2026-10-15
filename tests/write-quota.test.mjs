import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const {enforceWriteQuota,cleanupWriteQuota,ROOT_MUTATIONS_PER_MINUTE,OPERATOR_MUTATIONS_PER_MINUTE}=require('./.compiled/write-quota.js');
const root='phase20-super-secret-root-credential';
const origin='https://test.workers.dev';
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={ADMIN_TOKEN:root,DB:{prepare(sql){let args=[];return{bind(...x){args=x;return this},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const x=db.prepare(sql).run(...args);return{meta:{changes:x.changes}}}}}}};
 return{db,env};
}
async function api(env,path,method='GET',token=root,data){
 const headers={'Authorization':`Bearer ${token}`};
 if(data!==undefined)headers['Content-Type']='application/json';
 return worker.fetch(new Request(origin+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)}),env);
}
const principal=(id,role='operator')=>({kind:'key',role,id,label:'Scoped operator',prefix:'/api/'});
test('write quota uses atomic counters without storing secrets',async()=>{
 const {db,env}=fixture();try{
  const p=principal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await enforceWriteQuota(new Request(origin+'/api/workflows',{method:'POST'}),env,p,120_005);
  const row=db.prepare('SELECT * FROM api_write_quota').get();
  assert.equal(row.identity,`key:${p.id}`);
  assert.equal(row.minute_bucket,2);assert.equal(row.used,1);
  assert.equal(JSON.stringify(row).includes('Bearer'),false);
  await enforceWriteQuota(new Request(origin+'/api/overview'),env,p,120_007);
  assert.equal(db.prepare('SELECT used FROM api_write_quota').get().used,1,'reads must not consume write quota');
 }finally{db.close()}
});
test('different credentials get distinct counters and a new minute resets the quota',async()=>{
 const {db,env}=fixture();try{
  const a=principal('a'),b=principal('b');
  const req=new Request(origin+'/api/test',{method:'POST'});
  await enforceWriteQuota(req,env,a,61_000);
  await enforceWriteQuota(req,env,b,61_000);
  await enforceWriteQuota(req,env,a,121_000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM api_write_quota').get().n,3);
  assert.equal(db.prepare('SELECT used FROM api_write_quota WHERE identity=? AND minute_bucket=1').get('key:a').used,1);
 }finally{db.close()}
});
test('strict atomic mutation cap yields exactly 60 successes under concurrent claims',async()=>{
 const {db,env}=fixture();try{
  const p=principal('concurrent');const req=new Request(origin+'/api/seed',{method:'POST'});
  const batch=await Promise.allSettled(Array.from({length:OPERATOR_MUTATIONS_PER_MINUTE+15},()=>enforceWriteQuota(req,env,p,99_000)));
  assert.equal(batch.filter(x=>x.status==='fulfilled').length,OPERATOR_MUTATIONS_PER_MINUTE);
  const blocked=batch.filter(x=>x.status==='rejected');assert.equal(blocked.length,15);
  for(const failure of blocked){assert.equal(failure.reason.status,429);assert.equal(failure.reason.retryAfter,21)}
  assert.equal(db.prepare('SELECT used FROM api_write_quota').get().used,OPERATOR_MUTATIONS_PER_MINUTE);
 }finally{db.close()}
});
test('root quota is separate and viewer cannot mutate',async()=>{
 const {db,env}=fixture();try{
  const req=new Request(origin+'/api/test',{method:'POST'});
  await enforceWriteQuota(req,env,{kind:'root',role:'admin',id:null,label:'Root',prefix:'/api/'},80_000);
  assert.equal(db.prepare('SELECT used FROM api_write_quota WHERE identity=?').get('root').used,1);
  await assert.rejects(enforceWriteQuota(req,env,principal('read-only','viewer'),80_000),e=>e.status===403);
  assert.equal(ROOT_MUTATIONS_PER_MINUTE>OPERATOR_MUTATIONS_PER_MINUTE,true);
 }finally{db.close()}
});
test('quota fails closed if persistence fails',async()=>{
 const failing={DB:{prepare(){throw new Error('Database is offline')}}};
 await assert.rejects(enforceWriteQuota(new Request(origin+'/api/test',{method:'POST'}),failing,principal('offline')),/Database is offline/);
});
test('expired write counters can be pruned without touching the active window',async()=>{
 const {db,env}=fixture();try{
  const p=principal('retention');const req=new Request(origin+'/api/test',{method:'POST'});
  await enforceWriteQuota(req,env,p,60_000);
  await enforceWriteQuota(req,env,p,90_000_000);
  const deleted=await cleanupWriteQuota(env,90_000_000);
  assert.equal(deleted,1);
  assert.equal(db.prepare('SELECT count(*) n FROM api_write_quota').get().n,1);
 }finally{db.close()}
});
test('Worker gateway returns 429 Retry-After after per-key budget and does not spill across keys',async()=>{
 const {db,env}=fixture();try{
  const create=async label=>{
   const result=await api(env,'/api/access/keys','POST',root,{label,role:'operator',route_prefix:'/api/',expires_in_days:1});
   assert.equal(result.status,201);return (await result.json()).token;
  };
  const token=await create('limit-key-1'),other=await create('limit-key-2');
  for(let i=0;i<OPERATOR_MUTATIONS_PER_MINUTE;i++){
   const res=await api(env,'/api/endpoint-that-does-not-exist','POST',token,{});
   assert.equal(res.status,404,'unknown endpoint still consumes a mutation attempt');
  }
  const denied=await api(env,'/api/endpoint-that-does-not-exist','POST',token,{});
  assert.equal(denied.status,429);assert.match(denied.headers.get('Retry-After')||'',/^\d+$/);
  assert.equal(denied.headers.get('Cache-Control'),'no-store');
  assert.equal((await api(env,'/api/endpoint-that-does-not-exist','POST',other,{})).status,404);
  assert.equal((await api(env,'/api/overview','GET',token)).status,200,'reads stay available after writes hit limit');
  assert.equal((await api(env,'/api/access/write-quota','GET',token)).status,403,'operators cannot inspect other keys');
 }finally{db.close()}
});
test('root-only usage report contains counts and limits without secret hashes or tokens',async()=>{
 const {db,env}=fixture();try{
  let response=await api(env,'/api/access/write-quota');assert.equal(response.status,200);
  let result=await response.json();assert.equal(result.window_seconds,60);
  assert.equal(result.operator_limit,OPERATOR_MUTATIONS_PER_MINUTE);assert.equal(result.root_limit,ROOT_MUTATIONS_PER_MINUTE);
  assert.equal(result.active_identities,0);
  const create=await api(env,'/api/access/keys','POST',root,{label:'test',role:'viewer',expires_in_days:7});
  assert.equal(create.status,201);const token=(await create.json()).token;
  response=await api(env,'/api/access/write-quota');result=await response.json();
  assert.equal(result.active_identities,1);
  assert.equal(JSON.stringify(result).includes(token),false);
  assert.equal(JSON.stringify(result).includes('secret_hash'),false);
  assert.equal((await api(env,'/api/access/write-quota','GET',token)).status,403);
  const maintenance=await api(env,'/api/access/write-quota/prune','POST',root,{});
  assert.equal(maintenance.status,200);
 }finally{db.close()}
});

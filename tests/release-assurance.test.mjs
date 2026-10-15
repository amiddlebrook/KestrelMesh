import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const app=require('./.compiled/index.js').default;
const TOKEN='an-enterprise-qa-root-secret';
const base='https://security-check.workers.dev';
const local='http://localhost:8787';
function setup(){
 const db=new DatabaseSync(':memory:');
 for(const name of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+name,'utf8'));
 const env={ADMIN_TOKEN:TOKEN,DB:{prepare(sql){let args=[];return {
  bind(...v){args=v;return this},
  async first(){return db.prepare(sql).get(...args)??null},
  async all(){return {results:db.prepare(sql).all(...args)}},
  async run(){const x=db.prepare(sql).run(...args);return {meta:{changes:x.changes}}}
 }}}};return {db,env};
}
async function call(env,path,{method='GET',token=TOKEN,payload,origin=base,rawBody,headers={}}={}){
 const init={method,headers:{...headers}};
 if(token)init.headers.Authorization='Bearer '+token;
 if(payload!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(payload)}
 if(rawBody!==undefined){init.headers['Content-Type']='application/json';init.body=rawBody}
 return app.fetch(new Request(origin+path,init),env);
}
test('localhost and 127.0.0.1 cannot bypass authentication or secret configuration',async()=>{
 const {db,env}=setup();try{
  for(const origin of [base,local,'http://127.0.0.1:8787']){
   assert.equal((await call(env,'/api/overview',{origin,token:''})).status,401);
   assert.equal((await call({...env,ADMIN_TOKEN:undefined},'/api/overview',{origin,token:''})).status,503);
   assert.equal((await call(env,'/api/overview',{origin})).status,200);
  }
 }finally{db.close()}
});
test('API adds no-store, correlation and restrictive security headers',async()=>{
 const {db,env}=setup();try{
  for(const path of ['/api/health','/api/overview']){
   const res=await call(env,path);
   assert.equal(res.headers.get('X-Content-Type-Options'),'nosniff');
   assert.equal(res.headers.get('X-Frame-Options'),'DENY');
   assert.equal(res.headers.get('Referrer-Policy'),'no-referrer');
   assert.match(res.headers.get('Content-Security-Policy')||'',/default-src 'none'/);
   assert.match(res.headers.get('X-Request-ID')||'',/^[a-f0-9-]{36}$/);
   assert.equal(res.headers.get('Cache-Control'),'no-store');
  }
  const denied=await call(env,'/api/overview',{token:''});
  assert.equal(denied.headers.get('X-Frame-Options'),'DENY');
 }finally{db.close()}
});
test('operator can delete only its own saved perspectives; viewers cannot mutate',async()=>{
 const {db,env}=setup();try{
  const issue=async(role,label)=>{
   const res=await call(env,'/api/access/keys',{method:'POST',payload:{label,role,route_prefix:'/api/',expires_in_days:1}});
   assert.equal(res.status,201);return (await res.json()).token;
  };
  const operator=await issue('operator','e2e-operator'),outsider=await issue('operator','e2e-outsider'),viewer=await issue('viewer','e2e-viewer');
  const save=await call(env,'/api/views',{method:'POST',token:operator,payload:{section:'overview',name:'My safe perspective',query:'',preset:'all',order:'newest'}});
  assert.equal(save.status,201);const {id}=await save.json();
  assert.equal((await call(env,'/api/views/'+id,{method:'DELETE',token:outsider})).status,404);
  assert.equal((await call(env,'/api/views/'+id,{method:'DELETE',token:viewer})).status,403);
  assert.equal((await call(env,'/api/access/keys',{method:'GET',token:operator})).status,403);
  assert.equal((await call(env,'/api/ops/prune',{method:'POST',token:operator,payload:{confirm:'DELETE_OLD_ACTIVITY',older_than_days:30}})).status,403);
  const ok=await call(env,'/api/views/'+id,{method:'DELETE',token:operator});
  assert.equal(ok.status,200);assert.equal((await ok.json()).deleted,true);
  assert.equal((await call(env,'/api/views/'+id,{token:operator})).status,404);
 }finally{db.close()}
});
test('bounded JSON reader rejects declared and streamed over-limit bodies',async()=>{
 const {db,env}=setup();try{
  let res=await call(env,'/api/access/keys',{method:'POST',rawBody:JSON.stringify({label:'🙂'.repeat(3500),role:'viewer'}),headers:{}});
  assert.equal(res.status,413);
  res=await call(env,'/api/access/keys',{method:'POST',rawBody:JSON.stringify({label:'tiny'}),headers:{'Content-Length':'15000'}});
  assert.equal(res.status,413);
  res=await call(env,'/api/access/keys',{method:'POST',rawBody:'{"label":'});
  assert.equal(res.status,400);
 }finally{db.close()}
});
test('static asset rules enforce no inline scripts, deny framing and prevent MIME sniffing',()=>{
 const rules=readFileSync('public/_headers','utf8');
 assert.match(rules,/script-src 'self'/);assert.doesNotMatch(rules,/script-src\s+[^;]*unsafe-inline/);
 assert.match(rules,/frame-ancestors 'none'/);assert.match(rules,/X-Content-Type-Options: nosniff/);
 assert.match(rules,/Strict-Transport-Security:/);
});

test('revoked and expired bearer credentials fail closed and scope cannot leak',async()=>{
 const {db,env}=setup();try{
  const issued=await call(env,'/api/access/keys',{method:'POST',payload:{label:'catalog-read',role:'viewer',route_prefix:'/api/catalog/',expires_in_days:1}});
  assert.equal(issued.status,201);const key=await issued.json();
  assert.equal((await call(env,'/api/catalog',{token:key.token})).status,200);
  const index=await (await call(env,'/api/catalog',{token:key.token})).json();
  const collection=index.collections?.[0]?.id;assert.ok(collection);
  assert.equal((await call(env,'/api/catalog/'+collection+'?size=10',{token:key.token})).status,200);
  assert.equal((await call(env,'/api/overview',{token:key.token})).status,403);
  assert.equal((await call(env,'/api/access/insights',{token:key.token})).status,403);
  assert.equal((await call(env,`/api/access/keys/${key.id}/revoke`,{method:'POST'})).status,200);
  assert.equal((await call(env,'/api/catalog',{token:key.token})).status,401);
  const issued2=await call(env,'/api/access/keys',{method:'POST',payload:{label:'expired-case',role:'viewer',route_prefix:'/api/',expires_in_days:1}});
  const second=await issued2.json();
  db.prepare('UPDATE access_keys SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',second.id);
  assert.equal((await call(env,'/api/catalog',{token:second.token})).status,401);
 }finally{db.close()}
});
test('UTF-8 request byte accounting rejects multibyte oversized payload and disallows non-JSON bodies',async()=>{
 const {db,env}=setup();try{
  const over=await call(env,'/api/ops/prune',{method:'POST',rawBody:JSON.stringify({confirm:'DELETE_OLD_ACTIVITY',older_than_days:30,padding:'💥'.repeat(200)})});
  assert.equal(over.status,413);
  // Content-Type here is deliberately overridden by call(rawBody), so make an explicit request.
  const res=await app.fetch(new Request(base+'/api/access/keys',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'text/plain'},body:'{}'}),env);
  assert.equal(res.status,415);
 }finally{db.close()}
});

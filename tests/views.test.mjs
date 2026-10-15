import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {viewsApi}=require('./.compiled/views.js');
const root={kind:'root',role:'admin',id:null,label:'Root',prefix:'/api/'};
const userA={kind:'key',role:'operator',id:'a',label:'A',prefix:'/api/'};
const userB={kind:'key',role:'operator',id:'b',label:'B',prefix:'/api/'};
const reader={kind:'key',role:'viewer',id:'b',label:'Read',prefix:'/api/'};
function envFixture(){const db=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={DB:{prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}}};return {db,env}}
function call(env,path,method='GET',data,principal=root){const req=new Request('http://localhost'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});return viewsApi(req,env,new URL(req.url),principal)}
const record={name:'Critical cases',section:'workflows',query:'refund',preset:'attention',order:'newest'};
test('D1-backed views persist, support filtering, and reject duplicate names',async()=>{const {db,env}=envFixture();try{
 const created=await call(env,'/api/views','POST',record,userA);assert.equal(created.status,201);const value=await created.json();assert.match(value.id,/^[0-9a-f-]{36}$/);
 const response=await call(env,'/api/views?section=workflows','GET',undefined,userA);const data=await response.json();assert.equal(data.items.length,1);assert.equal(data.items[0].query,'refund');
 const one=await call(env,`/api/views/${value.id}`,'GET',undefined,userA);assert.equal((await one.json()).name,'Critical cases');
 await assert.rejects(call(env,'/api/views','POST',record,userA),/already exists/);
 assert.deepEqual((await (await call(env,'/api/views?section=events','GET',undefined,userA)).json()).items,[]);
}finally{db.close()}});
test('views are isolated by key, and read-only keys cannot modify any view',async()=>{const {db,env}=envFixture();try{
 const created=await (await call(env,'/api/views','POST',record,userA)).json();
 assert.equal((await (await call(env,'/api/views','GET',undefined,userB)).json()).items.length,0);
 await assert.rejects(call(env,`/api/views/${created.id}`,'GET',undefined,userB),/not found/);
 await assert.rejects(call(env,`/api/views/${created.id}`,'DELETE',undefined,userB),/not found/);
 await assert.rejects(call(env,'/api/views','POST',record,reader),/Read-only/);
 await assert.rejects(call(env,`/api/views/${created.id}`,'DELETE',undefined,reader),/Read-only/);
 assert.equal((await call(env,`/api/views/${created.id}`,'DELETE',undefined,userA)).status,200);
 await assert.rejects(call(env,`/api/views/${created.id}`,'GET',undefined,userA),/not found/);
}finally{db.close()}});
test('rejects untrusted search, status and sort payloads and limits saved views',async()=>{const {db,env}=envFixture();try{
 for(const bad of [{...record,section:'../admin'},{...record,order:'DROP TABLE'},{...record,query:'x'.repeat(201)},{...record,preset:'<img>'},{...record,name:'a'.repeat(71)}])await assert.rejects(call(env,'/api/views','POST',bad,userA));
 for(let i=0;i<40;i++){const r=await call(env,'/api/views','POST',{...record,name:'view-'+i},userA);assert.equal(r.status,201)}
 await assert.rejects(call(env,'/api/views','POST',{...record,name:'overflow'},userA),/limit reached/);
}finally{db.close()}});
test('UI controls have no fake data and never put credentials in links',()=>{const src=readFileSync('public/saved-views.js','utf8');const shell=readFileSync('public/index.html','utf8');const app=readFileSync('public/app.js','utf8');assert.ok(src.includes('navigator.clipboard.writeText'));assert.ok(src.includes('requires this view'));assert.ok(!src.includes('admin-token'));assert.ok(shell.includes('/saved-views.css'));assert.ok(app.includes('mountSavedViews'));const interaction=readFileSync('public/interaction.js','utf8');assert.ok(interaction.includes("action:'focus'"));assert.ok(interaction.includes("action:'density'"));assert.ok(interaction.includes("toggleMode('focus')"));});

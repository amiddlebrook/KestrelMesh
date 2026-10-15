import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const app=require('./.compiled/index.js');
const advanced=require('./.compiled/advanced.js');
function env(){const sql=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('migrations/'+f,'utf8'));return {sql,DB:{prepare(q){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(q).all(...args)}},async first(){return sql.prepare(q).get(...args)??null},async run(){const x=sql.prepare(q).run(...args);return {meta:{changes:x.changes}}}}}},FREE_AI_ENABLED:'true',AI:{async run(){return {response:'Fixture response'}}},stop(){sql.close()}}}
async function call(e,path,data,method){const req=new Request('http://localhost:8787'+path,{method:method||(data===undefined?'GET':'POST'),headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const res=await app.api(req,e,new URL(req.url));if(!res.ok)throw new Error(`${path} ${res.status} ${await res.text()}`);return res.json()}
async function rejected(e,path,data,status){const req=new Request('http://localhost:8787'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});await assert.rejects(()=>app.api(req,e,new URL(req.url)),ex=>ex.status===status)}
test('half-open recovery lease permits only one active probe and expires safely',async()=>{const e=env();try{
const m=await call(e,'/api/models',{name:'Fixture model',provider:'fixture',priority:1});
const closed=await advanced.acquireHalfOpenProbe(e,m.id);assert.equal(closed.allowed,true);assert.equal(closed.lease_id,null);
e.sql.prepare('INSERT INTO circuit_breakers VALUES(?,?,?,?,?)').run(m.id,'open',3,'2020-01-01T00:00:00Z','2020-01-01T00:00:00Z');
const [a,b]=await Promise.all([advanced.acquireHalfOpenProbe(e,m.id),advanced.acquireHalfOpenProbe(e,m.id)]);
assert.equal(Number(a.allowed)+Number(b.allowed),1);const granted=a.allowed?a:b;
const pending=await call(e,'/api/circuit-leases');assert.equal(pending.items.length,1);
await advanced.releaseHalfOpenProbe(e,m.id,'wrong-lease');assert.equal((await call(e,'/api/circuit-leases')).items.length,1);
await advanced.releaseHalfOpenProbe(e,m.id,granted.lease_id);assert.equal((await call(e,'/api/circuit-leases')).items.length,0);
const next=await advanced.acquireHalfOpenProbe(e,m.id);assert.equal(next.allowed,true);
}finally{e.stop()}});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const app=require('./.compiled/index.js');
const db=new DatabaseSync(':memory:');
db.exec(readFileSync('migrations/0001_init.sql','utf8'));
const env={DB:{prepare(query){let a=[];return {bind(...x){a=x;return this},async all(){return {results:db.prepare(query).all(...a)}},async first(){return db.prepare(query).get(...a)??null},async run(){const x=db.prepare(query).run(...a);return {meta:{changes:x.changes}}}}}},AI:{async run(){return {response:'Deterministic test adapter response; not live inference.'}}}};
async function call(path,data){const url=new URL('http://localhost:8787'+path);const req=new Request(url,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const res=await app.api(req,env,url);if(!res.ok)throw new Error(`${url} returned ${res.status}: ${await res.text()}`);return res.json()}
test('migrations, seed and overview roundtrip',async()=>{const seed=await call('/api/seed',{});assert.ok(seed);const summary=await call('/api/overview');assert.ok(summary.metrics?.length>0);db.close()});

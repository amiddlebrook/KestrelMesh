import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {studioApi}=require('./.compiled/studio.js');
import {renderStudio} from '../public/studio.js';
function environment(){const db=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+name,'utf8'));return {db,env:{DB:{prepare(q){let args=[];return {bind(...a){args=a;return this},async all(){return {results:db.prepare(q).all(...args)}},async first(){return db.prepare(q).get(...args)||null},async run(){const x=db.prepare(q).run(...args);return {meta:{changes:x.changes}}}}}}}}}
async function call(env,route,method='GET'){const req=new Request('http://localhost:8787'+route,{method});return studioApi(req,env,new URL(req.url))}

test('specialized KestrelMesh studio reads actual SQLite state',async()=>{
 const {db,env}=environment();try{db.exec(`INSERT INTO models VALUES('m','Production provider','fixture','fixture',1,1,'2026-01-01'); INSERT INTO circuit_breakers VALUES('m','closed',0,NULL,'2026-01-01');`);db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?)').run('r','m','sample','completed',123,5,10,0,new Date().toISOString(),'');
 const response=await call(env,'/api/studio/traffic');assert.equal(response.status,200);const body=await response.json();assert.equal(body.totals.count,1);assert.equal(body.totals.p95,123);assert.equal(body.providers[0].circuit,'closed');assert.equal(body.totals.confidence,'limited');
 const denied=await call(env,'/api/studio/traffic','POST');assert.equal(denied.status,405);
 }finally{db.close()}
});
test('studio endpoints require a dedicated protected route and a working JS module',async()=>{const {db,env}=environment();try{assert.equal(await call(env,'/api/studio/missing'),null);assert.equal(typeof renderStudio,'function');}finally{db.close()}});
import {errorBudget} from '../public/studio.js';
test('SLO headroom supports non-99 objectives',()=>{assert.equal(errorBudget(98.5,99),-.5);assert.equal(errorBudget(null,99),null)});

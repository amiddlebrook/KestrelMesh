import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const root='super-secure-phase21-maintenance-admin';
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const env={ADMIN_TOKEN:root,DB:{prepare(sql){let args=[];return{bind(...x){args=x;return this},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const x=db.prepare(sql).run(...args);return{meta:{changes:x.changes}}}}}}};
 return{db,env};
}
async function api(env,path,token=root){return worker.fetch(new Request('https://test.workers.dev'+path,{headers:token?{Authorization:`Bearer ${token}`}:{}}),env)}
test('cron maintenance removes expired quota counters and records completion',async()=>{
 const {db,env}=fixture();try{
  db.prepare('INSERT INTO api_write_quota(identity,minute_bucket,used) VALUES(?,?,?)').run('stale',1,5);
  const minute=Math.floor(Date.now()/60000);
  db.prepare('INSERT INTO api_write_quota(identity,minute_bucket,used) VALUES(?,?,?)').run('current',minute,1);
  const before=await api(env,'/api/access/maintenance');assert.equal(before.status,200);assert.equal((await before.json()).status,'not_yet_run');
  await worker.scheduled({cron:'0 4 * * *'},env);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM api_write_quota').get().n,1);
  const after=await api(env,'/api/access/maintenance');assert.equal(after.status,200);const report=await after.json();
  assert.equal(report.rows_pruned,1);assert.equal(report.status,'reported');assert.match(report.last_run,/^\d{4}-/);
  assert.equal(report.schedule,'0 4 * * *');
  await worker.scheduled({cron:'0 4 * * *'},env);
  assert.equal(db.prepare('SELECT rows_pruned FROM maintenance_status').get().rows_pruned,0,'repeat run is idempotent');
 }finally{db.close()}
});
test('maintenance stays restricted to Cloudflare scheduler, never public unauthenticated HTTP',async()=>{
 const {db,env}=fixture();try{
  assert.equal((await api(env,'/api/access/maintenance','')).status,401);
  assert.equal((await api(env,'/api/access/maintenance','wrong-key')).status,401);
  await assert.rejects(worker.scheduled({cron:'* * * * *'},env),/Unknown maintenance schedule/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM maintenance_status').get().n,0);
 }finally{db.close()}
});

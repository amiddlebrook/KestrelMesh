import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {filterActivity} from '../public/ops.js';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
function fixture(){const db=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));const env={ADMIN_TOKEN:'private-suite-key-not-for-sharing',DB:{prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return db.prepare(q).get(...args)||null},async all(){return {results:db.prepare(q).all(...args)}},async run(){const r=db.prepare(q).run(...args);return{meta:{changes:r.changes}}}}}}};return{db,env}}
const base='https://prod-sample.workers.dev';
const token='private-suite-key-not-for-sharing';
const call=(env,path,method='GET',withRoot=true,data)=>worker.fetch(new Request(base+path,{method,headers:{...(withRoot?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)}),env);
test('administrative activity routes are root-only, with request identifiers',async()=>{const {db,env}=fixture();try{
 const unauthorized=await call(env,'/api/ops/activity','GET',false);assert.equal(unauthorized.status,401);
 const allowed=await call(env,'/api/ops/activity');assert.equal(allowed.status,200);assert.ok(allowed.headers.get('x-request-id'));assert.deepEqual((await allowed.json()).items,[]);
 const summary=await (await call(env,'/api/ops/summary')).json();assert.equal(summary.mutations,0);assert.equal(summary.failed,0);
}finally{db.close()}});
test('mutations create redacted diagnostic rows, never request queries or secrets',async()=>{const {db,env}=fixture();try{
 const denied=await call(env,'/api/ops/prune?secret=dont-log-this','POST',true,{older_than_days:60});assert.equal(denied.status,400);
 const ok=await call(env,'/api/ops/prune','POST',true,{older_than_days:60,confirm:'DELETE_OLD_ACTIVITY'});assert.equal(ok.status,200);
 const {items}=await (await call(env,'/api/ops/activity?limit=10')).json();assert.equal(items.length,2);assert.equal(items.find(x=>x.status===400)?.method,'POST');
 const event=db.prepare('SELECT * FROM api_activity ORDER BY created_at DESC LIMIT 1').get();assert.equal(event.actor_kind,'root');assert.equal(event.actor_id,null);
 const stored=JSON.stringify(db.prepare('SELECT * FROM api_activity').all());assert.equal(stored.includes('private-suite-key'),false);assert.equal(stored.includes('dont-log-this'),false);assert.equal(stored.includes('DELETE_OLD_ACTIVITY'),false);
 const stats=await (await call(env,'/api/ops/summary')).json();assert.equal(stats.mutations,2);assert.equal(stats.failed,1);
}finally{db.close()}});
test('operation list validates cursor and deletion requires explicit confirmation',async()=>{const {db,env}=fixture();try{
 const bad=await call(env,'/api/ops/activity?before=garbage');assert.equal(bad.status,400);
 const malicious=await call(env,'/api/ops/prune','POST',true,{older_than_days:1,confirm:'DELETE_OLD_ACTIVITY'});assert.equal(malicious.status,400);
}finally{db.close()}});
test('operations view offers accurate in-memory filtering',()=>{
 const rows=[{method:'POST',path:'/api/models',status:201,actor_role:'admin'},{method:'DELETE',path:'/api/experiments',status:403,actor_role:'operator'}];
 assert.equal(filterActivity(rows,{query:'models'}).length,1);
 assert.equal(filterActivity(rows,{outcome:'failed'}).length,1);
 assert.equal(filterActivity(rows,{outcome:'succeeded'}).length,1);
});

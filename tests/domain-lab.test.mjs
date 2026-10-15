import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const worker=require('./.compiled/index.js').default;
const domain=require('./.compiled/domain-lab.js');
const rootToken='phase22-test-root-secret';
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));
 const env={ADMIN_TOKEN:rootToken,DB:{prepare(sql){let x=[];return{bind(...args){x=args;return this},async first(){return db.prepare(sql).get(...x)??null},async all(){return{results:db.prepare(sql).all(...x)}},async run(){const result=db.prepare(sql).run(...x);return{meta:{changes:result.changes}}}}}}};
 return{db,env};
}
async function call(env,path,method='GET',data,token=rootToken){
 const req=new Request('https://tests.workers.dev'+path,{method,headers:{Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});
 const result=await worker.fetch(req,env);
 return{status:result.status,body:await result.json()};
}

test('routing replay respects rule specificity, disabled targets and fallback',()=>{
 const models=[{id:'m1',name:'Fast fixture',provider:'fixture',enabled:1,priority:10},{id:'m2',name:'AI target',provider:'workers_ai',enabled:1,priority:20}];
 const rules=[{id:'r1',name:'Billing',model_id:'m2',match_prefix:'bill'},{id:'r2',name:'Billing urgent',model_id:'m1',match_prefix:'billing:urgent'}];
 const out=domain.routeReplay(['billing:urgent refund','billing:invoice','ordinary'],models,rules,new Set());
 assert.equal(out.routes[0].model,'Fast fixture');assert.equal(out.routes[0].route,'Billing urgent');assert.equal(out.routes[1].model,'AI target');assert.equal(out.routes[2].model,'Fast fixture');
 const disabled=domain.routeReplay(['billing:invoice'],models,rules,new Set(['m2','m1']));assert.equal(disabled.unroutable,1);
});
test('routing simulation makes no inference request or cache mutation',async()=>{
 const{db,env}=fixture();try{
 db.prepare('INSERT INTO models VALUES(?,?,?,?,?,?,?)').run('m','Fixture','fixture','fixture',1,1,'2026');
 const r=await call(env,'/api/lab/routing/replay','POST',{tasks:['triage ticket','billing check']});assert.equal(r.status,200);assert.equal(r.body.routes.length,2);assert.equal(r.body.routes[0].provider,'fixture');
 assert.equal(db.prepare('SELECT count(*) n FROM requests').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM response_cache').get().n,0);
 assert.equal((await call(env,'/api/lab/routing/replay','POST',{tasks:[]})).status,400);
 }finally{db.close()}
});

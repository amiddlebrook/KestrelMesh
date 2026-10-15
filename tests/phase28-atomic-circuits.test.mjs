import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
const advanced=createRequire(import.meta.url)('./.compiled/advanced.js');
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));
 db.prepare('INSERT INTO models(id,name,provider,model_ref,priority,enabled,created_at) VALUES(?,?,?,?,?,?,?)').run('m1','Free local fixture','fixture','local',1,1,new Date().toISOString());
 return{db,env:{DB:{prepare(sql){let p=[];return{bind(...a){p=a;return this},async first(){return db.prepare(sql).get(...p)??null},async all(){return{results:db.prepare(sql).all(...p)}},async run(){const r=db.prepare(sql).run(...p);return{meta:{changes:r.changes}}}}}}}};
}
test('atomic circuit counts concurrent failures without losing increments or duplicating opening events',async()=>{
 const {db,env}=fixture();try{
 await Promise.all(Array.from({length:12},()=>advanced.recordCircuit(env,'m1',false)));
 const state=db.prepare('SELECT * FROM circuit_breakers WHERE model_id=?').get('m1');
 assert.equal(state.state,'open');assert.equal(state.consecutive_failures,12);
 const events=db.prepare('SELECT * FROM circuit_events WHERE model_id=?').all('m1');
 assert.equal(events.length,1);assert.equal(events[0].from_state,'closed');assert.equal(events[0].to_state,'open');
 await advanced.recordCircuit(env,'m1',true);
 assert.equal(db.prepare('SELECT state FROM circuit_breakers WHERE model_id=?').get('m1').state,'closed');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM circuit_events WHERE model_id=?').get('m1').n,2);
 }finally{db.close()}
});
test('event insert failure atomically rolls back circuit state update',async()=>{
 const {db,env}=fixture();try{
 await advanced.recordCircuit(env,'m1',false);await advanced.recordCircuit(env,'m1',false);
 db.exec("CREATE TRIGGER block_circuit_audit BEFORE INSERT ON circuit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
 await assert.rejects(()=>advanced.recordCircuit(env,'m1',false),/audit unavailable/);
 const s=db.prepare('SELECT state,consecutive_failures FROM circuit_breakers WHERE model_id=?').get('m1');
 assert.equal(s.state,'closed');assert.equal(s.consecutive_failures,2);
 assert.equal(db.prepare('SELECT count(*) n FROM circuit_events').get().n,0);
 }finally{db.close()}
});

import {body,first,list,execute,uid,now,json,required,fail,limit,type Env} from './core';
type Circuit={model_id:string,state:'closed'|'open'|'half_open',consecutive_failures:number,opened_until:string|null,updated_at:string};
export function effectiveState(c:Circuit|null,time:string):string{return !c?'closed':c.state==='open'&&c.opened_until&&c.opened_until<=time?'half_open':c.state}
export async function disabledByCircuit(env:Env):Promise<Set<string>>{
 const circuits=await list<Circuit>(env,'SELECT * FROM circuit_breakers');const timestamp=now();
 return new Set(circuits.filter(c=>effectiveState(c,timestamp)==='open').map(c=>c.model_id));
}
export async function acquireHalfOpenProbe(env:Env,modelId:string):Promise<{allowed:boolean;lease_id:string|null;state:string}>{
 const circuit=await first<Circuit>(env,'SELECT * FROM circuit_breakers WHERE model_id=?',modelId);
 const state=effectiveState(circuit,now());
 if(state==='open')return {allowed:false,lease_id:null,state};
 if(state==='closed')return {allowed:true,lease_id:null,state};
 const token=uid(),expiry=new Date(Date.now()+30000).toISOString(),timestamp=now();
 // SQLite UPSERT CAS: only one concurrent half-open request can hold the slot.
 const result=await env.DB.prepare('INSERT INTO circuit_leases(model_id,lease_id,expires_at,created_at) VALUES(?,?,?,?) ON CONFLICT(model_id) DO UPDATE SET lease_id=excluded.lease_id,expires_at=excluded.expires_at,created_at=excluded.created_at WHERE circuit_leases.expires_at<=?').bind(modelId,token,expiry,timestamp,timestamp).run();
 return {allowed:!!result.meta?.changes,lease_id:result.meta?.changes?token:null,state};
}
export async function releaseHalfOpenProbe(env:Env,modelId:string,leaseId:string|null):Promise<void>{
 if(leaseId)await execute(env,'DELETE FROM circuit_leases WHERE model_id=? AND lease_id=?',modelId,leaseId);
}
export async function recordCircuit(env:Env,modelId:string,success:boolean):Promise<void>{
 // A single D1 statement observes the current counter at write time. No stale read/modify/write race.
 const timestamp=now(),until=new Date(Date.now()+60000).toISOString();
 const failureScore="CASE WHEN circuit_breakers.state='half_open' OR (circuit_breakers.state='open' AND circuit_breakers.opened_until<=excluded.updated_at) THEN 3 ELSE MIN(circuit_breakers.consecutive_failures+1,1000000000) END";
 const update=success
  ? "state='closed',consecutive_failures=0,opened_until=NULL,updated_at=excluded.updated_at"
  : `state=CASE WHEN (${failureScore})>=3 THEN 'open' ELSE circuit_breakers.state END,consecutive_failures=${failureScore},opened_until=CASE WHEN (${failureScore})>=3 THEN ? ELSE circuit_breakers.opened_until END,updated_at=excluded.updated_at`;
 const sql=`INSERT INTO circuit_breakers(model_id,state,consecutive_failures,opened_until,updated_at) VALUES(?,'closed',?,NULL,?) ON CONFLICT(model_id) DO UPDATE SET ${update}`;
 if(success)await execute(env,sql,modelId,0,timestamp);
 else await execute(env,sql,modelId,1,timestamp,until);
 // The database trigger records state transitions inside this same atomic write.
}
export async function advancedApi(req:Request,env:Env,url:URL):Promise<Response|null>{
 const p=url.pathname,m=req.method;
 if(p==='/api/circuits'&&m==='GET'){
  const timestamp=now();const rows=await list<Circuit&{model:string}>(env,'SELECT c.*,c.model_id id,m.name model FROM circuit_breakers c JOIN models m ON m.id=c.model_id ORDER BY c.updated_at DESC LIMIT ?',limit(url));
  return json({items:rows.map(c=>({...c,effective_state:effectiveState(c,timestamp)}))});
 }
 if(p==='/api/circuit-leases'&&m==='GET')return json({items:await list(env,'SELECT l.model_id,m.name model,l.expires_at,l.created_at FROM circuit_leases l JOIN models m ON m.id=l.model_id ORDER BY l.created_at DESC LIMIT ?',limit(url))});
 if(p==='/api/circuit-events'&&m==='GET')return json({items:await list(env,'SELECT e.*,m.name model FROM circuit_events e JOIN models m ON m.id=e.model_id ORDER BY e.created_at DESC LIMIT ?',limit(url))});
 const reset=p.match(/^\/api\/circuits\/([^/]+)\/reset$/);
 if(reset&&m==='POST'){
  const model=await first<{id:string}>(env,'SELECT id FROM models WHERE id=?',reset[1]);if(!model)fail(404,'Model not found');
  await execute(env,"INSERT INTO circuit_breakers VALUES(?,'closed',0,NULL,?) ON CONFLICT(model_id) DO UPDATE SET state='closed',consecutive_failures=0,opened_until=NULL,updated_at=excluded.updated_at",model.id,now());
  return json({model_id:model.id,state:'closed'});
 }
 return null;
}

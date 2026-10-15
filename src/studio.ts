import {list,json,type Env} from './core';
export function percentile(values:number[],p:number):number|null{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(p*sorted.length)-1]??null}
export async function studioApi(req:Request,env:Env,url:URL):Promise<Response|null>{
 if(url.pathname!=='/api/studio/traffic')return null;
 if(req.method!=='GET')return Response.json({error:'Method not allowed'},{status:405});
 const requested=Number(url.searchParams.get('hours')||24);const hours=[1,24,168].includes(requested)?requested:24;
 const cutoff=new Date(Date.now()-hours*3600000).toISOString();
 const [requests,models,circuits]=await Promise.all([
  list<{model_id:string;status:string;latency_ms:number;cache_hit:number;created_at:string}>(env,'SELECT model_id,status,latency_ms,cache_hit,created_at FROM requests WHERE created_at >= ? ORDER BY created_at DESC LIMIT 1501',cutoff),
  list<{id:string;name:string;provider:string;enabled:number}>(env,'SELECT id,name,provider,enabled FROM models ORDER BY priority LIMIT 70'),
  list<{model_id:string;state:string;consecutive_failures:number}>(env,'SELECT model_id,state,consecutive_failures FROM circuit_breakers LIMIT 70')
 ]);
 const truncated=requests.length>1500;const observations=requests.slice(0,1500);
 const stats=(items:typeof observations)=>{const total=items.length;const success=items.filter(x=>x.status==='completed');const fails=total-success.length;const latency=success.filter(x=>!x.cache_hit).map(x=>x.latency_ms).filter(x=>x>=0);return {count:total,success:success.length,failed:fails,availability:total?+(100*success.length/total).toFixed(2):null,p50:percentile(latency,.5),p95:percentile(latency,.95),cache_hits:items.filter(x=>!!x.cache_hit).length,confidence:total>=20&&!truncated?'observational':'limited'}};
 const circuit=new Map(circuits.map(x=>[x.model_id,x]));
 const providers=models.map(m=>({...m,circuit:circuit.get(m.id)?.state||'untracked',stats:stats(observations.filter(r=>r.model_id===m.id))}));
 const buckets=Array.from({length:12},(_,i)=>{const start=Date.now()-(12-i)*hours*3600000/12;const end=start+hours*3600000/12;const slice=observations.filter(r=>{const t=Date.parse(r.created_at);return t>=start&&t<end});return {start:new Date(start).toISOString(),...stats(slice)}});
 return json({hours,totals:stats(observations),providers,buckets,truncated,note:truncated?'Only the most recent 1,500 requests are shown. Rates may not represent the full period.':'Availability is based on recorded requests only; no synthetic probes or SLA guarantees.'});
}

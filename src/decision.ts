import {body,first,list,execute,json,required,fail,now,type Env} from './core';
type Model={id:string;name:string;provider:string;enabled:number};
type RequestRow={model_id:string;status:string;latency_ms:number;cache_hit:number;created_at:string};
export function evaluateWindow(rows:RequestRow[],target:number,p95Target:number){const total=rows.length;const succeeded=rows.filter(x=>x.status==='completed');const observed=total?100*succeeded.length/total:null;const times=succeeded.map(x=>x.latency_ms).sort((a,b)=>a-b);const p95=times.length?times[Math.ceil(.95*times.length)-1]:null;return {sample_count:total,success_count:succeeded.length,observed_pct:observed,p95_ms:p95,target_pct:target,p95_target_ms:p95Target,meets_target:total>=10&&observed!==null&&observed>=target&&p95!==null&&p95<=p95Target,insufficient_samples:total<10};}
export async function decisionApi(req:Request,env:Env,url:URL):Promise<Response|null>{
 const p=url.pathname;
 if(p==='/api/decision/objectives'&&req.method==='GET'){
  const [models,policies,requests]=await Promise.all([list<Model>(env,'SELECT id,name,provider,enabled FROM models ORDER BY name LIMIT 100'),list<{model_id:string;target_pct:number;p95_target_ms:number;updated_at:string}>(env,'SELECT * FROM inference_objectives LIMIT 100'),list<RequestRow>(env,"SELECT model_id,status,latency_ms,cache_hit,created_at FROM requests WHERE created_at >= ? ORDER BY created_at DESC LIMIT 3000",new Date(Date.now()-24*3600000).toISOString())]);
  const map=new Map(policies.map(x=>[x.model_id,x]));return json({models:models.map(model=>{const policy=map.get(model.id);return {...model,objective:policy||null,observation:policy?evaluateWindow(requests.filter(x=>x.model_id===model.id),policy.target_pct,policy.p95_target_ms):null}}),window_hours:24,limit:3000,note:'Observed request history, not synthetic traffic. No conclusion under 10 samples; p95 includes cache hits.'});
 }
 if(p==='/api/decision/objectives'&&req.method==='POST'){
  const b=await body(req,5000);const id=required(b.model_id,'model_id',100);if(!await first(env,'SELECT id FROM models WHERE id=?',id))fail(404,'Model not found');
  const target=Number(b.target_pct),p95=Number(b.p95_target_ms);if(!Number.isFinite(target)||target<90||target>100)fail(400,'target_pct must be 90–100');if(!Number.isInteger(p95)||p95<1||p95>60000)fail(400,'p95_target_ms must be an integer from 1 to 60000');
  await execute(env,'INSERT INTO inference_objectives VALUES(?,?,?,?) ON CONFLICT(model_id) DO UPDATE SET target_pct=excluded.target_pct,p95_target_ms=excluded.p95_target_ms,updated_at=excluded.updated_at',id,target,p95,now());return json({saved:true,model_id:id},200);
 }
 if(p.startsWith('/api/decision/'))fail(404,'Unknown objectives endpoint');return null;
}

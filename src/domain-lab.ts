import {body,fail,json,required,list,type Env} from './core';
import {chooseModel} from './index';
import {disabledByCircuit} from './advanced';
type Model={id:string;name:string;provider:'fixture'|'workers_ai';model_ref:string;priority:number;enabled:number};
type Route={id:string;name:string;match_prefix:string;model_id:string};
export function routeReplay(tasks:string[],models:Model[],rules:Route[],disabled:Set<string>){
 const eligible=models.filter(m=>!disabled.has(m.id));
 const routes=tasks.map((task,index)=>{
  const selected=chooseModel(eligible,task,rules);
  const matched=selected?[...rules].filter(r=>r.model_id===selected.id&&task.toLowerCase().startsWith(r.match_prefix.toLowerCase())).sort((a,b)=>b.match_prefix.length-a.match_prefix.length)[0]:undefined;
  return {ordinal:index+1,task_preview:task.slice(0,100),route:matched?matched.name:'priority fallback',matched_prefix:matched?.match_prefix??null,model_id:selected?.id??null,model:selected?.name??null,provider:selected?.provider??null,reason:selected?'matched enabled rule or priority fallback':'no eligible model',requires_ai:selected?.provider==='workers_ai'};
 });
 const counts=routes.reduce<Record<string,number>>((m,r)=>{const key=r.model??'unroutable';m[key]=(m[key]||0)+1;return m;},{});
 return {routes,distribution:counts,unroutable:routes.filter(r=>!r.model).length,excluded_circuit_models:models.filter(m=>disabled.has(m.id)).map(m=>m.name),mode:'dry-run only; zero model calls, zero cache writes'};
}
export async function domainLabApi(req:Request,env:Env,url:URL):Promise<Response|null>{
 if(url.pathname!=='/api/lab/routing/replay'||req.method!=='POST')return null;
 const input=(await body(req)).tasks;
 if(!Array.isArray(input)||input.length<1||input.length>40)fail(400,'Provide between 1 and 40 tasks');
 const tasks=input.map((v:unknown,i:number)=>required(v,`tasks[${i}]`,1000));
 const [models,rules,disabled]=await Promise.all([list<Model>(env,'SELECT * FROM models ORDER BY priority ASC'),list<Route>(env,'SELECT * FROM routing_rules'),disabledByCircuit(env)]);
 return json(routeReplay(tasks,models,rules,disabled));
}

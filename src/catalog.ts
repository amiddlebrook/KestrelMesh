import {fail,first,list,json,type Env} from './core';
type Definition = {label:string; table:string; projection:string; search:string[]; facet?:string};
const registry:Record<string,Definition> = {
  "models": {
    "label": "Model fleet",
    "table": "models",
    "projection": "id,name,provider,model_ref,priority,enabled,created_at",
    "search": [
      "name",
      "provider",
      "model_ref"
    ],
    "facet": "enabled"
  },
  "requests": {
    "label": "Inference telemetry",
    "table": "requests",
    "projection": "id,model_id,status,latency_ms,input_chars,output_chars,cache_hit,created_at",
    "search": [
      "model_id",
      "status",
      "error"
    ],
    "facet": "status"
  },
  "rules": {
    "label": "Routing policies",
    "table": "routing_rules",
    "projection": "id,name,match_prefix,model_id,created_at",
    "search": [
      "name",
      "match_prefix",
      "model_id"
    ]
  },
  "events": {
    "label": "Circuit transitions",
    "table": "circuit_events",
    "projection": "id,model_id,from_state,to_state,substr(reason,1,220) AS reason,created_at",
    "search": [
      "model_id",
      "from_state",
      "to_state",
      "reason"
    ],
    "facet": "to_state"
  }
};
export const availableCatalogs = Object.keys(registry);
function str(raw:string|null, max:number, label:string) {
 const value=raw||'';
 if(value.length>max) fail(400,`${label} must be ${max} characters or less`);
 return value.trim();
}
function encodeCursor(created_at:string,id:string,collection:string,query:string,facet:string):string {
 return btoa(JSON.stringify([created_at,id,collection,query,facet])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeCursor(raw:string,collection:string,query:string,facet:string):[string,string] {
 if(raw.length>1300||!/^[A-Za-z0-9_-]+$/.test(raw)) fail(400,'Invalid page cursor');
 try {
   const v:unknown=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')));
   if(!Array.isArray(v)||v.length!==5||v[2]!==collection||v[3]!==query||v[4]!==facet||
      typeof v[0]!=='string'||typeof v[1]!=='string'||v[0].length>80||v[1].length>100 || !v[0]||!v[1])throw Error('bad cursor');
   return [v[0],v[1]];
 }catch {return fail(400,'Invalid or stale page cursor')}
}
function likeTerm(q:string){return `%${q.replace(/[\\%_]/g,'\\$&')}%`}
export async function catalogApi(req:Request,env:Env,url:URL):Promise<Response|null> {
 const path=url.pathname;
 if(path==='/api/catalog'&&req.method==='GET') return json({collections:Object.entries(registry).map(([id,d])=>({id,label:d.label,fields:d.projection.split(',').map(s=>s.trim().split(/\s+AS\s+/i).pop()),faceted:!!d.facet}))});
 if(!path.startsWith('/api/catalog/'))return null;
 if(req.method!=='GET')fail(405,'Catalog is read-only');
 const id=path.slice('/api/catalog/'.length);
 const def=Object.prototype.hasOwnProperty.call(registry,id)?registry[id]:null;
 if(!def) fail(404,'Unknown catalog');
 const q=str(url.searchParams.get('q'),100,'Search');
 const facet=str(url.searchParams.get('facet'),80,'Filter');
 if(facet&&!def.facet) fail(400,'This catalog has no status filter');
 const rawSize=url.searchParams.get('size')||'20';
 if(!/^(10|20|50)$/.test(rawSize))fail(400,'Page size must be 10, 20, or 50');
 const size=Number(rawSize);
 let filter='1=1';const bind:unknown[]=[];
 if(q){filter+=' AND ('+def.search.map(c=>`LOWER(${c}) LIKE ? ESCAPE '\\'`).join(' OR ')+')';const needle=likeTerm(q.toLowerCase());for(const field of def.search)bind.push(needle)}
 if(facet){filter+=` AND CAST(${def.facet} AS TEXT)=?`;bind.push(facet)}
 const cursor=url.searchParams.get('cursor');const values=[...bind];
 if(cursor){const [ts,pk]=decodeCursor(cursor,id,q,facet);filter+=' AND (created_at<? OR (created_at=? AND id<?))';values.push(ts,ts,pk)}
 const entries=await list<Record<string,unknown>>(env,`SELECT ${def.projection} FROM ${def.table} WHERE ${filter} ORDER BY created_at DESC,id DESC LIMIT ?`,...values,size+1);
 const items=entries.slice(0,size);
 const next=entries.length>size && items.length?encodeCursor(String(items[items.length-1].created_at),String(items[items.length-1].id),id,q,facet):null;
 // Count from the same filters but *not* the cursor. Always count records in D1, never guess from the current page.
 const where=filter.split(' AND (created_at<? OR (created_at=? AND id<?))')[0];
 const countRow=await first<{n:number}>(env,`SELECT COUNT(*) AS n FROM ${def.table} WHERE ${where}`,...bind);
 const facets=def.facet?await list<{state:string,n:number}>(env,`SELECT CAST(${def.facet} AS TEXT) state,COUNT(*) AS n FROM ${def.table} GROUP BY ${def.facet} ORDER BY n DESC LIMIT 24`):[];
 return json({collection:id,label:def.label,items,total:Number(countRow?.n||0),next_cursor:next,page_size:size,facets,query:q,active_facet:facet,order:'created_at_desc_id_desc',scope:'credential_authorized_catalog',counted_at:new Date().toISOString()});
}

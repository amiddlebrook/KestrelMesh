/** Credential-isolated saved working views. Never store access tokens or raw records here. */
import {body, first, list, json, fail, now, uid, required, type Env} from './core';
import type {Principal} from './access';

type SavedView = {id:string;owner:string;section:string;name:string;query:string;preset:string;sort_order:string;created_at:string;updated_at:string};
const sectionPattern=/^[a-z][a-z0-9-]{0,63}$/;
const filterPattern=/^[a-z][a-z0-9-]{0,39}$/;
const viewIdPattern=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/;
const ownerOf=(p:Principal)=>p.kind==='root'?'root':`key:${p.id}`;
function validSection(raw:unknown){if(typeof raw!=='string'||!sectionPattern.test(raw))fail(400,'Invalid section');return raw as string}
function validFilter(raw:unknown,label:string){if(typeof raw!=='string'||!filterPattern.test(raw))fail(400,`Invalid ${label}`);return raw as string}
function readView(b:Record<string,any>){
 const section=validSection(b.section);
 const name=required(b.name,'name',70);
 const query=b.query===undefined?'':b.query;
 if(typeof query!=='string'||query.length>200)fail(400,'Query must be at most 200 characters');
 const preset=validFilter(b.preset??'all','preset');
 const order=b.order??'newest';
 if(!['newest','oldest','az'].includes(order))fail(400,'Invalid order');
 return {section,name,query,preset,order};
}
export async function viewsApi(req:Request,env:Env,url:URL,principal:Principal):Promise<Response|null>{
 const pathname=url.pathname;
 if(pathname!=='/api/views'&&!pathname.startsWith('/api/views/'))return null;
 const owner=ownerOf(principal);
 if(pathname==='/api/views'&&req.method==='GET'){
   const section=url.searchParams.get('section');
   if(section!==null)validSection(section);
   const items=section
    ?await list<SavedView>(env,'SELECT id,section,name,query,preset,sort_order,created_at,updated_at FROM saved_views WHERE owner=? AND section=? ORDER BY updated_at DESC LIMIT 100',owner,section)
    :await list<SavedView>(env,'SELECT id,section,name,query,preset,sort_order,created_at,updated_at FROM saved_views WHERE owner=? ORDER BY updated_at DESC LIMIT 100',owner);
   return json({items:items.map(({sort_order,...item})=>({...item,order:sort_order}))});
 }
 if(principal.role==='viewer')fail(403,'Read-only credential');
 if(pathname==='/api/views'&&req.method==='POST'){
   const data=readView(await body(req,5000));
   const n=await first<{n:number}>(env,'SELECT COUNT(*) n FROM saved_views WHERE owner=?',owner);
   if(Number(n?.n||0)>=40)fail(409,'Saved view limit reached (40 per credential)');
   const id=uid(),ts=now();
   const result=await env.DB.prepare('INSERT OR IGNORE INTO saved_views(id,owner,section,name,query,preset,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,owner,data.section,data.name,data.query,data.preset,data.order,ts,ts).run();
   if(!result.meta?.changes)fail(409,'A saved view with this name already exists in this section');
   return json({id,...data,created_at:ts,updated_at:ts},201);
 }
 const match=/^\/api\/views\/([^/]+)$/.exec(pathname);
 if(match){
   if(!viewIdPattern.test(match[1]))fail(404,'Saved view not found');
   if(req.method==='GET'){
    const item=await first<SavedView>(env,'SELECT id,section,name,query,preset,sort_order,created_at,updated_at FROM saved_views WHERE id=? AND owner=?',match[1],owner);
    if(!item)fail(404,'Saved view not found');
    const {sort_order,...rest}=item;return json({...rest,order:sort_order});
   }
   if(req.method==='DELETE'){
    const r=await env.DB.prepare('DELETE FROM saved_views WHERE id=? AND owner=?').bind(match[1],owner).run();
    if(!r.meta?.changes)fail(404,'Saved view not found');
    return json({deleted:true,id:match[1]});
   }
 }
 fail(405,'Unsupported saved-view method');
}

/** Immutable operator review and exportable evidence dossier for bounded agent runs. */
import {body,first,list,json,fail,now,uid,type Env} from './core';
import type {Principal} from './access';

type AgentSession={id:string;objective:string;status:string;step_count:number;max_steps:number;answer:string;error:string;created_at:string;updated_at:string};
type ReviewRow={id:string;session_id:string;verdict:string;note:string;reviewed_by:string;created_at:string};
type TraceRow={id:string;session_id:string;ordinal:number;kind:string;tool:string;payload:string;created_at:string};
const isUUID=(path:string)=>/^\/api\/agents\/([0-9a-f-]{36})\/(dossier|review)$/.exec(path);
async function digest(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function agentReviewApi(req:Request,env:Env,url:URL,principal:Principal):Promise<Response|null>{
 if(url.pathname==='/api/agents/review/capabilities' && req.method==='GET'){const count=await first<{n:number}>(env,'SELECT COUNT(*) n FROM agent_reviews');return json({schema_version:1,immutable:true,requires_root_admin:true,review_count:count?.n??0});}
 const match=isUUID(url.pathname);if(!match)return null;
 const [,id,resource]=match;
 const session=await first<AgentSession>(env,'SELECT * FROM agent_sessions WHERE id=?',id);
 if(!session)fail(404,'Agent session not found');
 if(resource==='dossier'&&req.method==='GET'){
  const rows=await list<TraceRow>(env,'SELECT * FROM agent_events WHERE session_id=? ORDER BY ordinal ASC LIMIT 20',id);
  const review=await first<ReviewRow>(env,'SELECT * FROM agent_reviews WHERE session_id=?',id);
  const events=rows.map(e=>({ordinal:e.ordinal,kind:e.kind,tool:e.tool,payload:JSON.parse(e.payload),created_at:e.created_at}));
  const content={schema_version:'1.0',kind:'agent_evidence_dossier',session,events,review,disclaimer:'Snapshot only. Digest detects changes to this representation; it is not a cryptographic signature or a compliance-grade audit.'};
  return json({...content,sha256:await digest(JSON.stringify(content))});
 }
 if(resource==='review'&&req.method==='GET'){
  const review=await first<ReviewRow>(env,'SELECT * FROM agent_reviews WHERE session_id=?',id);
  return json({session_id:id,review,immutable:true});
 }
 if(resource==='review'&&req.method==='POST'){
  if(principal.role!=='admin')fail(403,'Only the root administrator can sign an agent review');
  if(!['completed','needs_review','failed'].includes(session.status))fail(409,'Only completed or stopped runs can be reviewed');
  const input=await body(req,4000);
  if(!['accepted','rejected','requires_followup'].includes(input.verdict))fail(400,'Invalid review verdict');
  if(input.verdict==='accepted'&&session.status!=='completed')fail(409,'Unfinished or failed reasoning cannot be accepted');
  if(typeof input.note!=='string'||input.note.trim().length<12||input.note.length>1500)fail(400,'A 12-1500 character review justification is required');
  const item={id:uid(),session_id:id,verdict:input.verdict,note:input.note.trim(),reviewed_by:principal.label,created_at:now()};
  const insert=await env.DB.prepare('INSERT OR IGNORE INTO agent_reviews(id,session_id,verdict,note,reviewed_by,created_at) VALUES(?,?,?,?,?,?)').bind(item.id,id,item.verdict,item.note,item.reviewed_by,item.created_at).run();
  if((insert.meta?.changes??0)!==1)fail(409,'An immutable review already exists for this session');
  return json({review:item,immutable:true,does_not_authorize_external_actions:true},201);
 }
 fail(405,'Unsupported dossier action');
}

/** Portable Cloudflare Worker helpers, shared by five separately deployable applications. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number; last_row_id?: number } }>;
}
export interface D1DB { prepare(sql: string): D1Statement; batch?(statements: D1Statement[]): Promise<unknown[]> }
export interface Env {
  DB: D1DB;
  AI?: { run(model: string, options: { messages: { role: string; content: string }[]; max_tokens?: number }): Promise<{ response?: string; result?: { response?: string } }> };
  ADMIN_TOKEN?: string;
  FREE_AI_ENABLED?: string;
}
export type Handler = (req: Request, env: Env, url: URL) => Promise<Response>;
export class HttpError extends Error { constructor(public status: number, message: string, public retryAfter?: number) { super(message) } }
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export function json(data: unknown, status = 200): Response { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }) }
export function fail(status: number, message: string): never { throw new HttpError(status, message) }
export function required(value: unknown, name: string, max = 255): string {
  if (typeof value !== 'string' || !value.trim()) return fail(400, `${name} is required`);
  if (value.length > max) return fail(400, `${name} exceeds ${max} characters`);
  return value.trim();
}
export function oneOf(value: unknown, allowed: string[], name: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) return fail(400, `${name} must be one of ${allowed.join(', ')}`);
  return value;
}
export async function body(req:Request,max=120_000):Promise<Record<string,any>> {
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(req.headers.get('content-type')||''))fail(415,'Content-Type must be application/json');
 const declared=req.headers.get('content-length');
 if(declared && /^\d+$/.test(declared) && Number(declared)>max)fail(413,'Request too large');
 if(!req.body)fail(400,'Invalid JSON object');
 const reader=req.body.getReader();
 const chunks:Uint8Array[]=[];let received=0;
 try {
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   received+=value.byteLength;
   if(received>max){void reader.cancel().catch(()=>{});fail(413,'Request too large');}
   chunks.push(value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(received);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try {
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid object');
  return value as Record<string,any>;
 }catch{fail(400,'Invalid JSON object')}
}
export function limit(url: URL, max = 100): number { return Math.max(1, Math.min(max, Number(url.searchParams.get('limit')) || 30)) }
export function pathId(url: URL, prefix: string): string | null {
  const fragment = url.pathname.slice(prefix.length);
  return fragment && !fragment.includes('/') ? fragment : null;
}
export async function list<T = Record<string, unknown>>(env: Env, sql: string, ...params: unknown[]): Promise<T[]> {
  return (await env.DB.prepare(sql).bind(...params).all<T>()).results;
}
export async function first<T = Record<string, unknown>>(env: Env, sql: string, ...params: unknown[]): Promise<T | null> {
  return env.DB.prepare(sql).bind(...params).first<T>();
}
export async function execute(env: Env, sql: string, ...params: unknown[]): Promise<void> {
  await env.DB.prepare(sql).bind(...params).run();
}
export function parseObject<T>(value: unknown, fallback: T): T {
  try { return typeof value === 'string' ? JSON.parse(value) as T : fallback } catch { return fallback }
}
export function number(value: unknown, fallback = 0): number { const x = Number(value); return Number.isFinite(x) ? x : fallback }
export async function generate(env: Env, system: string, user: string, maxTokens = 512): Promise<string> {
  if (!env.AI) return fail(503, 'Workers AI binding is not configured');
  const {reserveFreeAI}=await import('./free-tier');
  await reserveFreeAI(env);
  let result: { response?: string; result?: { response?: string } };
  try { result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: Math.min(maxTokens, 1024)
  }) } catch (err) { return fail(503, `Workers AI request failed or daily free allowance reached: ${String(err).slice(0, 250)}`) }
  return result.response ?? result.result?.response ?? fail(502, 'AI provider returned no text');
}
export function count(row: { n: number } | null): number { return Number(row?.n || 0) }
/** API-only response hardening. Static asset policies live in public/_headers. */
function secure(res:Response,requestId:string):Response {
 res.headers.set('X-Request-ID',requestId);
 res.headers.set('Cache-Control','no-store');
 res.headers.set('X-Content-Type-Options','nosniff');
 res.headers.set('X-Frame-Options','DENY');
 res.headers.set('Referrer-Policy','no-referrer');
 res.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 res.headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
 res.headers.set('Strict-Transport-Security','max-age=31536000');
 return res;
}
export async function withApi(req: Request, env: Env, fn: Handler): Promise<Response> {
  const url = new URL(req.url);
  const requestId = uid();
  const started = Date.now();
  if(req.method==='OPTIONS')return secure(new Response(null,{status:204,headers:{Allow:'GET, HEAD, POST, DELETE, OPTIONS'}}),requestId);
  if(url.pathname==='/api/health' && (req.method==='GET'||req.method==='HEAD')){
   return secure(json({ok:true,app:'online',time:now()}),requestId);
  }
  // A request URL or Host header must never grant administrator access.
  // Local `wrangler dev` uses .dev.vars ADMIN_TOKEN, exactly like production.
  if(!env.ADMIN_TOKEN){const res=json({error:'Deployment disabled: configure ADMIN_TOKEN Worker secret'},503);return secure(res,requestId);}
  let principal:import('./access').Principal|null=null;
  let response:Response;
  try {
   const access=await import('./access');
   principal=await access.authenticate(req,env,url);
   const free=await import('./free-tier');
   await free.reserveBudget(env,'api',free.API_REQUESTS_PER_DAY);
   // Reserve one D1 write quota slot BEFORE any mutating API can execute.
   // Atomic UPSERT prevents concurrent requests from exceeding a credential's budget.
   const quotas=await import('./write-quota');
   await quotas.enforceWriteQuota(req,env,principal);
   const managed=await access.accessApi(req,env,url,principal);
   const operations=await import('./operations');
   const review=await import('./agent-review');
   const catalog=await import('./catalog');
   const views=await import('./views');
   response=managed || (url.pathname==='/api/free-tier/status' && req.method==='GET' ? json(await free.budgetStatus(env)):null) || await catalog.catalogApi(req,env,url) || await views.viewsApi(req,env,url,principal) || await review.agentReviewApi(req,env,url,principal) || await operations.operationsApi(req,env,url,principal) || await fn(req,env,url);
  } catch(error) {
   if(error instanceof HttpError){
    response=json({error:error.message},error.status);
    if(error.status===429&&error.retryAfter)response.headers.set('Retry-After',String(error.retryAfter));
   }
   else {console.error('Request error',requestId,error);response=json({error:'Internal server error'},500);}
  }
  secure(response,requestId);
  // Best-effort write telemetry is explicitly NOT a transactional or forensic audit.
  if(principal && ['POST','PUT','PATCH','DELETE'].includes(req.method)){
   try {const operations=await import('./operations');await operations.recordWrite(env,principal,req,url.pathname,response.status,Date.now()-started,requestId);}
   catch(e){console.error('Diagnostic activity write failed',requestId,String(e));}
  }
  return response;
}

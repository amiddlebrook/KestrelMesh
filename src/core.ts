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
}
export type Handler = (req: Request, env: Env, url: URL) => Promise<Response>;
export class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
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
export async function body(req: Request, max = 120_000): Promise<Record<string, any>> {
  if (!req.headers.get('content-type')?.includes('application/json')) return fail(415, 'Content-Type must be application/json');
  const text = await req.text();
  if (text.length > max) return fail(413, 'Request too large');
  try { const parsed: unknown = JSON.parse(text); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be an object'); return parsed as Record<string, any> }
  catch { return fail(400, 'Invalid JSON object') }
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
  let result: { response?: string; result?: { response?: string } };
  try { result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: Math.min(maxTokens, 1024)
  }) } catch (err) { return fail(503, `Workers AI request failed or daily free allowance reached: ${String(err).slice(0, 250)}`) }
  return result.response ?? result.result?.response ?? fail(502, 'AI provider returned no text');
}
export function count(row: { n: number } | null): number { return Number(row?.n || 0) }
export async function withApi(req: Request, env: Env, fn: Handler): Promise<Response> {
  const url = new URL(req.url);
  const requestId = uid();
  const started = Date.now();
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{Allow:'GET, HEAD, POST, DELETE, OPTIONS','X-Request-ID':requestId}});
  if(url.pathname==='/api/health' && (req.method==='GET'||req.method==='HEAD')){
   const res=json({ok:true,app:'online',time:now()});res.headers.set('X-Request-ID',requestId);return res;
  }
  const local=['localhost','127.0.0.1'].includes(url.hostname);
  if(!local&&!env.ADMIN_TOKEN){const res=json({error:'Deployment disabled: configure ADMIN_TOKEN Worker secret'},503);res.headers.set('X-Request-ID',requestId);return res;}
  let principal:import('./access').Principal|null=null;
  let response:Response;
  try {
   const access=await import('./access');
   principal=local
     ? {kind:'root' as const,role:'admin' as const,id:null,label:'Local development',prefix:'/api/'}
     : await access.authenticate(req,env,url);
   const managed=await access.accessApi(req,env,url,principal);
   const operations=await import('./operations');
   response=managed || await operations.operationsApi(req,env,url,principal) || await fn(req,env,url);
  } catch(error) {
   if(error instanceof HttpError)response=json({error:error.message},error.status);
   else {console.error('Request error',requestId,error);response=json({error:'Internal server error'},500);}
  }
  response.headers.set('X-Request-ID',requestId);
  // Best-effort write telemetry is explicitly NOT a transactional or forensic audit.
  if(principal && ['POST','PUT','PATCH','DELETE'].includes(req.method)){
   try {const operations=await import('./operations');await operations.recordWrite(env,principal,req,url.pathname,response.status,Date.now()-started,requestId);}
   catch(e){console.error('Diagnostic activity write failed',requestId,String(e));}
  }
  return response;
}

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
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Allow': 'GET, POST, DELETE, OPTIONS' } });
  if (url.pathname === '/api/health') return json({ ok: true, app: 'online', time: now() });
  // The only unprotected mode is local Wrangler development. A public deployment
  // must have a separate secret, never shipped in JavaScript or checked into Git.
  const local = ['localhost','127.0.0.1'].includes(url.hostname);
  if (!local && !env.ADMIN_TOKEN) return json({ error: 'Deployment disabled: configure ADMIN_TOKEN Worker secret' }, 503);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!local && token !== env.ADMIN_TOKEN) return json({ error: 'Unauthorized' }, 401);
  try { return await fn(req, env, url) }
  catch (error) { if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Request error', error); return json({ error: 'Internal server error' }, 500) }
}

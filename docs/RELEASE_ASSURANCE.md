# Phase 18 — authenticated-by-default release controls

All API calls (including requests to `localhost` / `127.0.0.1`) require a valid Bearer credential, except the intentionally unauthenticated `/api/health` endpoint. **No request hostname is a substitute for authentication.** For local Wrangler development, set `ADMIN_TOKEN` in `.dev.vars` (never commit the file), then use Access Control → Connect to provide that token to the browser. Use a distinct local root token, never the production token.

The Worker attaches `X-Request-ID`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` and restrictive API `Content-Security-Policy` headers. Worker Static Assets attach equivalent browser security headers via `public/_headers` (Workers static assets do **not** inherit Worker-generated response headers).

`POST` handlers read JSON with a bounded **byte** budget, checking `Content-Length` first when present and also enforcing the ceiling against the streamed body. They reject oversized Unicode input before parsing; incomplete or malformed JSON returns an HTTP 400.

The operator role may delete **only its own** saved-view records at `/api/views/<uuid>`; all other operator DELETE routes remain blocked, and viewer credentials can never mutate views. Per-credential ownership is checked within the database deletion itself. This fixes the previously inconsistent UI/API behavior.

Security contracts are exercised through the compiled Worker's `.fetch` entrypoint against a real in-memory SQLite database that replays *every* shipped D1 migration. The production smoke script also verifies the new security response headers for both static HTML and protected Worker API endpoints. GitHub workflows currently use `npm install`; a committed lockfile and reproducible `npm ci` installation remain future supply-chain work.

## Remaining enterprise security requirements

- Organization / tenant row isolation, user identity federation and sessions, fine-grained resource policies.
- Durable tamper-evident audit log, rate limits and abuse controls, secrets rotation workflows, comprehensive threat model and penetration tests.
- Full authenticated production browser E2E and load, fault-injection, and disaster-recovery tests.
- CSP currently allows **inline styles**, not inline scripts; eliminating dynamic inline styles is an additional hardening task.
- Development instance security remains dependent on how `.dev.vars` is managed. Do not reuse production secrets in local `.dev.vars`.

No new third-party service and no database migration required. On Cloudflare Workers, `_headers` applies to static assets and is not a Worker API response policy, hence both policies are explicitly maintained.

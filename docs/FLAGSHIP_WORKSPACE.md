# Phase 15 — KestrelMesh flagship workspace

Telemetry Radar: latency scope, backend filters, threshold lens, circuit state and request inspector.

## How to use
Open the deployed app; the new mission workspace is now the default landing screen. Existing Overview and domain workspaces remain accessible from the navigation. Sign in using a valid API credential to display real records.

## Controls and data limits
This workspace reads existing authenticated domain API endpoints. It does not create or modify records. Charts, counts and comparisons are computed from records actually returned by the API; those endpoints are bounded and do not guarantee exhaustive organizational totals. Use the separate server-backed Records Explorer for paginated datasets.

## Authentication and deployment
No new D1 migrations, paid services, external CDN dependencies or secrets are introduced. The existing Cloudflare Workers/D1 authorization is used. GitHub Actions checks /mission.js and /mission.css after deploy.

## QA and outstanding enterprise requirements
Unit tests run with npm test and npm run check. Browser component testing ran at desktop and mobile widths using clearly labeled synthetic QA data; tests did not authenticate to the deployed application or exercise live persistence. Multi-organization row isolation, SSO/MFA, browser-wide integration testing, and formal capacity/security testing remain outstanding.

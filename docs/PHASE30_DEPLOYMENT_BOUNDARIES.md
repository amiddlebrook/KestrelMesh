# Phase 30 — Deployment-scope safety for KestrelMesh

The free-only deployment is deliberately **single-application, single-account**, not multitenant SaaS. `npm run verify:identity` is an enforced check in GitHub CI and the production deployment pipeline before any D1 migration. It rejects a wrong repo owner/name, Cloudflare Worker script name, D1 binding/name, production endpoint, or missing fail-closed free AI config.

The running application uses its own D1 database and scoped API tokens. This is **deployment configuration defense-in-depth**, not cryptographic attestation or proof of tenant isolation. Shared Cloudflare administrator credentials and an improperly configured account still have privileged cross-product access. A production multitenant implementation would require organization-owned records, every database query scoped to authorized organization, explicit cross-tenant tests, encryption and external security review.

Release gate: both GitHub CI and production deploy must pass the identity check before database provisioning, followed by release preflight, recovery drill, Cloudflare deployment, live HTTP checks, bounded edge latency and Chromium acceptance.

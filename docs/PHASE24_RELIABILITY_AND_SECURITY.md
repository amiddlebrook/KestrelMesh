# Phase 24 — Reliability and Authenticated API Verification

Routing previews exclude open circuit models and unknown model toggles return 404.

## Verification
- `npm run check`, `npm test`, `npm run verify:release`
- `tests/phase24.test.mjs` constructs a real isolated SQLite D1 fixture, issues a read-only scoped API credential, checks wrong-route and write denial, revokes the credential, and tests response security headers.
- Production Workers secret remains required and no unauthenticated access to private API data is introduced.

## Remaining limitations
This is account-scoped API-key security, **not multitenant isolation or SSO**. Credential-based browser automation against production is not run by the unit tests. Load testing and browser cross-device visual QA require separate evidence. A green CI run does not establish an enterprise security certification.

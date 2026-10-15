# KestrelMesh — Phase 31: Atomic credential audit and live least-privilege acceptance

## Production behavior

- Credential creation and its `issued` audit event commit in **one SQLite statement** through migration `0015_access_audit_atomic.sql`.
- Credential revocation and its `revoked` audit event also commit atomically, with no duplicate audit entry on reattempt.
- If an audit event cannot be stored, the credential state change is rolled back. Regression tests inject deliberate SQLite audit failures and verify that rollback.
- The root credential remains a GitHub Actions secret delivered to the Worker as `ADMIN_TOKEN`. Neither the CI test nor its logs expose a temporary token.

## Live acceptance gate

After deployment, `npm run verify:auth-live` creates **one** one-day viewer key scoped to `/api/overview/` and verifies that permitted reads succeed, writes and management endpoints are denied, adjacent URL prefixes are blocked, and revocation immediately invalidates access. A `finally` block attempts revocation after any intermediate test failure. A failed cleanup should be investigated via access audit; unattended credentials expire within a day.

The live check uses fewer than ten authenticated requests and no inference. It is constrained by the existing free-tier request and D1 budgets, does not require a paid service, and deliberately fails rather than silently overriding a free-tier limit.

## Limits

This verifies route-scoped, single-account credentials and immutable-by-trigger audit **coupling**, not tamper-evident logging, user identity management, or multitenant data isolation. Root administrators with direct D1 access can still alter audit rows. A cloud deployment failure or service outage is not eliminated by these tests.

D1 can count both the credential update and its audit trigger in `meta.changes`; the revoke endpoint treats any positive update count as a committed transition.

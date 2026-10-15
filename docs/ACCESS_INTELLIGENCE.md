# Phase 14 — Access Intelligence

## Implemented

Root-only governance endpoint `GET /api/access/insights`, computed from actual D1 `access_keys` and `api_activity` tables. All values are metadata; no secret hashes, access tokens, or request bodies are exposed. Key summary reports active, revoked, expired, expiring within seven days, unused, and dormant credentials. Distinct operational write activity is only a diagnostic sample.

The Access Control workspace provides a product-themed security cockpit with status tiles, exact key inventory, local filters, expiration lifetime bars, role/scope coverage, audit timeline, preset key issuance, a one-time secret dialog, typed revocation confirmation, manual sync, and metadata exports. It uses the existing root-only key lifecycle endpoints; no schema migration or paid service is required.

## Limits and deployment

Only the root ADMIN_TOKEN can view the governance data. A scoped key cannot read other credentials. The root secret must remain a Cloudflare secret, never entered into GitHub source or committed to any file. API key issuance is not account login, SSO, MFA, or organization isolation. Existing route-prefix permissions apply to the entire data set the route returns, and no tenant row filtering exists. Do not onboard mutually untrusted organizations under one deployment. `access_audit` is ordinary mutable D1 metadata; `api_activity` is best-effort and mutating authenticated requests only. It is not forensic evidence or compliance-grade logging.

## Verification

`npm run check`, `npm test`, and the Cloudflare deployment workflow `npm run verify:live`. New access regression tests assert that unauthenticated/delegated tokens are denied, metadata never includes plaintext/hash, and counts match issuance/revocation/expiry. Visual component fixture tests are separate from authenticated production browser E2E.

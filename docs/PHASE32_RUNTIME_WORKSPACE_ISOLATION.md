# KestrelMesh — Phase 32 runtime workspace isolation

This application explicitly supports **one installation-wide workspace**, not multi-customer tenant isolation. The database remains Cloudflare D1 on Workers Free. No new paid provider is used.

- Migration `0016_workspace_binding.sql` installs an immutable singleton app/Worker/database identity row. Existing identities are never overwritten.
- Every protected API request checks the D1 identity before authenticating or reading/writing records.
- Scheduled cleanup also checks the identity before modifying D1.
- The root-admin-only `GET /api/access/workspace` reports the active single-workspace boundary.
- Production deploy smoke tests check the verified binding and reject wrong database or app targets.
- Four SQL-backed test cases exercise correct identity, wrong database, missing identity, and scheduled work.

**Limitations:** This is a *fail-closed single-workspace fence*, not organization-level row-level authorization, SSO, independent secrets per customer, or proof of tenant isolation. A public health endpoint checks Worker availability only. A misconfigured deployment may still apply schema migrations to an unintended database before runtime checks; dedicated deploy-target safeguards must remain active. The workspace fence adds one D1 lookup per authenticated API request and is bound by the free-tier quota.

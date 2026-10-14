# KestrelMesh | Security boundaries

**Deployment scope:** single Cloudflare account, single database workspace, root Worker admin secret and optional hashed, expiring delegated API credentials. This is not enterprise SSO, organization-level RBAC, identity federation, or multi-tenant isolation.

## Authentication and authorization

- **Root:** `ADMIN_TOKEN` is a Cloudflare Worker secret set by GitHub Actions from `APP_ADMIN_TOKEN`. Only root can issue keys, view credential audit, and revoke keys. Rotate it by changing the GitHub secret and redeploying; old root tokens cease to work after the secret update is applied.
- **Delegated:** token format `efk_<uuid>_<random>`; server stores a SHA-256 digest, not plaintext. The API response returns plaintext once. Role (`viewer`/`operator`), normalized route prefix, expiry, revocation and last-use time are stored in D1.
- **Enforcement:** authorization is performed by `src/core.ts` and `src/access.ts` before domain handlers execute. Viewer is read-only; operator cannot use DELETE; only root manages `/api/access/*`.
- **Scope caveat:** API route-prefix authorization is not object-level permission or data separation. Creating an operator key with `/api/` provides broad write capability. Use the most restrictive scopes possible. No customer information should be placed in this demo while multi-tenant controls remain absent.
- **Audit:** credential issue/revoke events are persisted. This log is operational, not append-only or externally signed, and does not represent a forensic-grade security audit.

## Trust boundaries and threats

| Boundary | Existing control | Important gap |
|---|---|---|
| Public browser → API | HTTPS, bearer auth, explicit 401/403, no-store JSON | Demo browser keeps tokens in tab-scoped session storage; a compromised browser/XSS can read them |
| API → D1 | Parameterized SQL, input validation, migration history | Single shared workspace; no tenant-aware queries or row-level authorization |
| GitHub → Cloudflare | Scoped deployment token in Actions secrets, Wrangler Worker secret | No independent artifact signing, SBOM enforcement or protected production approval |
| AI text → application | Model outputs handled as untrusted content, no general unrestricted tool execution | Threat-model-specific prompt-injection validation and broad red-team testing outstanding |
| Operational telemetry | D1 audit rows, explicit errors, CI smoke tests | No external tamper-evident log, alerting SLA or retention policy |

## Credential operation

1. Store the root `APP_ADMIN_TOKEN` in GitHub Actions secrets and never in a source file.
2. Open **Access control** in the deployed UI using the root credential.
3. Issue a `viewer` token with the narrowest practical prefix and expiry; save it immediately in a password manager.
4. Revoke any token no longer required. A revoked key returns `401` on its next authenticated request.
5. Change the root secret if it is exposed. Regenerate delegated keys as needed, and review audit logs.

## Verification

`npm test` includes SQLite-backed issuance, expiry, route-boundary, viewer write-denial, operator delete-denial, revocation and secret-redaction assertions. The deploy workflow checks authentication against the live Worker and validates the `0004_access.sql` migration. These tests are **not** a replacement for external code review, incident response procedures, or a penetration test.

See [production-readiness backlog](ROADMAP.md).

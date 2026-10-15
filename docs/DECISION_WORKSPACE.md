# KestrelMesh — Decision workspace

This workspace operates on actual, authorized D1 data. It does not simulate business metrics or assert unmeasured outcomes. Write actions are denied to viewer keys via `access.ts`; API secrets never reach the public bundle.

## Contract

- `GET /api/decision/objectives` — authenticated overview
- `POST` to the same endpoint — validate and persist domain-specific work
- SQL migration: `0006_decisions.sql`
- User-facing workspace: `#decisions` / `public/decision.js`

## Limitations

The demo currently uses a root administrator token or scoped API keys, not tenant-enforced SSO. All conclusions must be checked against the underlying sampling and provenance constraints displayed in the UI.

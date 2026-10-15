# KestrelMesh — Phase 22: distinct product analysis workspace

This application gained a dedicated analysis workspace with its own API and behavior; the module is **not** a reused multi-product dashboard.

- API: `/api/lab/routing/replay`.
- Worker implementation: `src/domain-lab.ts`.
- Browser interface: `public/domain-lab.js` + `public/domain-lab.css`.
- Domain-level and authenticated SQLite integration tests: `tests/domain-lab.test.mjs`.
- Asset graph validation: `npm run verify:assets`.

Run `npm ci`, `npm run verify:release`, `npm run check` and `npm test` before deployment. This is an incremental portfolio release, **not** a statement of production-grade security certification. Live Cloudflare deployment and interactive browser testing were not carried out as part of this package.

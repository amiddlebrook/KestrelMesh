# Zero-cost operation contract — Phase 25

**This is an application-side budget policy, not a way to make unlimited cloud resources free.**

- Keep the Cloudflare account on **Workers Free** and avoid subscribing to a Paid plan. Billing status cannot be verified from inside the Worker. A paid Cloudflare account can incur charges for other resources regardless of these caps.
- No mandatory third-party AI keys, credit cards, paid inference endpoints, paid queues, or paid observability service.
- All applications retain independent source, routes, databases, product workflows and GitHub repositories. Only basic infrastructure quota code is similar.
- Cloudflare account-level shared quotas as of October 2026: Workers 100,000 requests/day; D1 5 million rows read/day and 100,000 rows written/day, 5GB storage; Workers AI 10,000 neurons/day; Queues 10,000 operations/day; Workflows 3,000 steps/day. Recheck provider docs periodically.
- Each application's authenticated API is limited to **1,200 requests/day**, and opt-in remote AI to **4 invocations/day**. These are conservative policy controls, **not neuron accounting**. Even one AI request can consume an uncertain number of neurons; Cloudflare Free will reject usage over its free allocation.
- `FREE_AI_ENABLED` defaults to `false` in `wrangler.jsonc`, meaning **remote AI is disabled in deployed applications by default**. Enable only after confirming the account remains on Workers Free and accepting the provider's finite free allocation. Deterministic sample and non-AI workflows remain available.
- `GET /api/free-tier/status` is authenticated and reports today's local application budget (UTC rollover). This is not a global Cloudflare usage report.
- When daily application budgets are exhausted, routes fail closed with `429`, a UTC-reset message, and a `Retry-After` header. No paid fallback is attempted.
- Cloudflare free-tier request and D1 limits are additional ceilings; when exceeded, requests can still fail earlier than local budgets. Static page traffic and unauthorized attempts also consume Cloudflare Worker requests but are not covered by our authenticated API budget.
- Local D1 counter records are pruned by the existing daily 04:00 UTC cron after 7 days. Tokens and model prompts are not recorded in these counters.

Links: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/workers-ai/platform/pricing/ ; https://developers.cloudflare.com/queues/platform/pricing/ ; https://developers.cloudflare.com/workflows/reference/pricing/ .

## Still required for full enterprise readiness

Cross-tenant isolation, identity federation, backup restore drills, transaction-safe external effects, dedicated per-product acceptance flows, sustained benchmark evidence, accessibility/browser audits and independent threat assessment remain incomplete. All requirements remain subject to free resource constraints.

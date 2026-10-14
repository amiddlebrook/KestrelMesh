# KestrelMesh

{'RivetFlow': 'Human-approved autonomous business workflows', 'ProofAtlas': 'Evidence-grounded document intelligence and graph search', 'SignalBench': 'Agent evaluation, regression and adversarial scenario suite', 'KestrelMesh': 'AI inference routing, caching and latency telemetry', 'GradientFoundry': 'Reproducible ML datasets, experiments and model registry'}. Independent application extracted from the Enterprise Five portfolio. **Functional MVP — not an enterprise production service.**

## Stack

Cloudflare Workers, D1 SQLite, Workers AI (free daily allowance), static Workers assets, TypeScript, vanilla JavaScript, GitHub Actions. No paid services are required for the small demonstration workloads.

## Run locally

```bash
npm install
npm run check
npm test
npm run db:local
npm run dev
```

Visit the localhost URL printed by Wrangler and use **Load sample data**. The application provides a database-backed API and interactive browser dashboard. AI-dependent operations call the Workers AI binding, subject to the free quota.

## Continuous deployment

Two GitHub Actions workflows are included: `ci.yml` runs checks/tests for pull requests and pushes, and `deploy.yml` runs checks/tests, creates/reuses the `portfolio-kestrelmesh-db` D1 database, applies migrations, and deploys `portfolio-kestrelmesh` on **every push to `main`**. The workflow fails clearly when credentials have not yet been configured.

Configure the repository **Actions Secrets** `CLOUDFLARE_API_TOKEN` (scoped to the intended account: Workers Scripts Edit, D1 Edit, relevant account read access) and `CLOUDFLARE_ACCOUNT_ID` (account ID, not password), plus `APP_ADMIN_TOKEN` (a long, randomly generated token unique to this app). Alternatively, use Cloudflare Workers Builds to connect your repository through GitHub, but do not enable two competing auto-deploy pipelines.

The application API protects all non-health endpoints with a Worker secret named `ADMIN_TOKEN` once deployed publicly. The deploy workflow automatically installs it from the GitHub `APP_ADMIN_TOKEN` secret with `wrangler secret put ADMIN_TOKEN` after publishing. Keep it out of the repo and browser source. To enter the token, click **API token** in the live dashboard. Without that Worker secret, the deployed API intentionally responds with 503.

## Deployment notes

- The checked-in D1 UUID is a placeholder for local development; GitHub Actions resolves the real database ID in its ephemeral runner without committing it.
- Public repo GitHub Actions minutes are free within GitHub's rules; Cloudflare resources are subject to account-wide free quotas. No billing upgrade is performed.
- Deployment cannot be verified until the scoped Cloudflare API token and account ID have been configured.
- The free-hosted deployment is public; API requests require the `ADMIN_TOKEN`. This is a demo security guard, not enterprise multi-user authentication.
- Worker domain after successful first deployment: `portfolio-kestrelmesh.<your-subdomain>.workers.dev`.

## Limitations

This is a scoped, functional MVP with a single privileged admin token; no SSO, formal audit certification, high availability promises, payment integrations, or large-model training. Run benchmarks before publishing performance claims.

## Engineering expansion — October 2026

- Persisted per-model circuit breakers with 60-second recovery and operator audit.
- Failed-provider exclusion during route selection and failure/recovery traces.

These are verifiable domain-specific features, **not** a claim of production maturity, SOC-2 certification, multi-tenant isolation, or unlimited free inference.

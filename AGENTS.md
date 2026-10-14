# Repository conventions

- Cloudflare Workers + D1 + Workers AI, Workers static assets.
- Preserve the no-paid-services constraint and avoid billing upgrades.
- GitHub Actions validates code on push and deploys `main` only after valid secrets exist.
- Never log API tokens, Worker secrets, or user documents.
- Test with `npm run check && npm test` before pushing.
- Keep this repository independently buildable; do not import paths from other repositories.
- This is the KestrelMesh functional portfolio MVP; do not claim enterprise-scale deployments without evidence.

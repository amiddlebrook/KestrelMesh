# KestrelMesh: Domain Studio (Phase 7)

This workspace is purpose-built for KestrelMesh; it is not a shared dashboard copy.

## Data and authorization

- Built from bounded, read-only Cloudflare D1 queries behind the same Worker authentication and delegated route scopes as the rest of the API.
- Endpoint: `GET /api/studio/traffic`.
- No fabricated metrics or synthetic traffic. Missing observations and inadequate samples are explicitly identified.
- Actions are links to established CRUD workflows. Studio analytics never write or silently execute operations.
- CI checks the new API, refuses unauthorized access, and verifies `/studio.js` and `/studio.css` in the deployed Worker.

## Operational boundaries

- Results are bounded for Cloudflare free-tier cost predictability. Sampling/collection truncation is documented in the JSON response.
- Studio views do not confer SSO, tenant isolation, compliance certifications, statistical guarantees, performance SLOs, or distributed fault tolerance.
- Actual interface rendering is still awaiting independent cross-browser screenshot and keyboard accessibility inspection.

## Manual quality checks

1. Open the live application unauthenticated; confirm no protected graph data is shown.
2. Authenticate with a valid credential and open the studio from its navigation.
3. Create or import data through its corresponding app workflow, then refresh the studio and compare the output.
4. Verify selected records and empty-state messaging on narrow and desktop viewport widths.
5. Test focus indication and navigation without a mouse.

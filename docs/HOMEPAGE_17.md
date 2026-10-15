# Phase 17 — KestrelMesh interactive home

- Main route directly opens the product's actual work surface: `km17-cli`.
- Authentication continues to gate real application data via existing API enforcement.
- If the homepage API fails, the view explicitly switches to an interactive **sample-data demonstration**, never presented as customer production data. Sample data is embedded in `public/home.js` and does not write to D1.
- All other app sections and actions remain accessible from existing navigation and continue to require authorization.
- `npm run check && npm test` validates the source and regression tests. `python3 visual_qa.py` in the release validates synthetic fixture and guest modes with Chromium when available.
- This release does not add organization row isolation, new database migrations, or paid providers. Do not claim full enterprise readiness.

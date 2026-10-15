# Saved perspectives — Phase 10

KestrelMesh now includes D1-backed personal filter perspectives on every tabular product module. Search, product-specific status preset, and ordering are saved; no source records, credentials, or bulk data are copied to `saved_views`.

## API

- `GET /api/views?section=workflows` lists up to 100 authorized views.
- `POST /api/views` creates a view with `name`, `section`, `query`, `preset`, and `order`.
- `GET /api/views/:id` reads a specific authorized view.
- `DELETE /api/views/:id` deletes an authorized view.

An owner is `root` for the root credential or `key:<id>` for a scoped key. All queries filter by owner. Viewers may read only; operators may create or delete, subject to their route-prefix scopes. UI links carry just an opaque view ID and section, not credentials; a recipient must already have authorized access to the same owner's saved view. There is intentionally no public sharing endpoint.

Up to 40 views per credential, 70-character names, and 200-character queries are supported. Search filters operate only on the current page of at most 100 loaded records, not a server-side database-wide search. GitHub deployment applies migration `0009_saved_views.sql`.

Run `npm run check && npm test` locally and use a real D1 database to exercise persistence.

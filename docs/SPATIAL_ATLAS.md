# Phase 12 — Live Atlas spatial intelligence

Live Atlas is a read-only, authenticated, domain-specific relationship workspace. Each product uses its own Cloudflare Workers/D1 API endpoints, rather than generated telemetry. It adds a cross-entity graph to the existing domain workbenches and does not replace create/approve/infer/train workflows.

## Product views

| Application | Shape | Live entity sources | Join rules |
|---|---|---|---|
| RivetFlow | Industrial process lanes | workflows, executions, approvals, operational audit | workflow IDs/names, run IDs |
| SignalBench | Circular evaluation constellation | suites, cases, targets, evaluation runs | suite IDs/names, target IDs/names |
| ProofAtlas | Evidence cartography | documents, claims, entities, relationships | document IDs/titles and explicit document references |
| KestrelMesh | Network mesh topology | model registry, route rules, inference traces, circuits | model IDs/names |
| GradientFoundry | Ordered lineage graph | datasets, experiments, training runs, registered models | dataset, experiment, and training run identifiers |

These links are derived from actual returned record reference properties. A name match must be unambiguous to create an edge. Absence of an edge is *not proof* that no relationship exists in the whole database, because results can be paginated or capped upstream.

## Controls and accessibility

- **Source toggles** show/hide individual entity layers; each source shows its loaded-record count.
- **Search** filters displayed/highlighted loaded node labels and status strings. Press `/` to focus search when outside a form field.
- **Pan and zoom** using click-and-drag on graph whitespace, zoom controls, `+`, `-`, and `0` (fit). Touch drag pans on phones; mobile initially zooms in for legibility.
- **Inspect** nodes via click or keyboard focus and Enter/Space. Arrow keys move focus between graph nodes. Escape clears selection.
- **Node context** displays the untouched source record, linked loaded neighbors, recorded timestamp, and the original workspace navigation destination. Copy JSON copies one record.
- **Auto-sync** is opt-in, checks every 60 seconds only while the document is visible, and stops when the page is changed. No browser background service is installed.
- **Export** requires confirmation and downloads the exact currently drawn node records/edges. Exported metadata is private and must be handled accordingly.
- **Reduced motion** is respected; native focus rings, SVG accessible node names, non-color labels, and explicit controls are provided.

## Enterprise boundaries

1. The diagram deliberately renders at most 20 records per entity layer (80 total), from data already limited by upstream APIs. Counts and summary panels show only returned data, not globally authoritative database counts. It reports any additional locally returned records omitted by the drawing cap.
2. No persistent or server-side graph index, cross-organization sharing, permissions elevation, or automated production actions are introduced. All source reads are made through existing authenticated endpoint logic.
3. It is *not* a replacement for server-side cursor pagination, hardened role/tenant isolation, production-scale load testing, high-cardinality virtualization, and full automated browser E2E suites. Those remain milestones for enterprise completion.
4. Each of the five products can operate on Cloudflare/GitHub free tiers within applicable platform quotas. There are no new mandatory paid services, packages, graph engines, or frontend frameworks.

## Verification

`npm run check && npm test` in each application. Phase 12 tests cover source-only graphs, deduplicated links, absence of guessed edges, ambiguous-name suppression, cap warnings, all five deterministic layout modes, and XSS escaping. Deployed CI also checks that the atlas JavaScript and CSS assets are served. Desktop and mobile visual interaction checks were run in Chromium using a synthetic *QA fixture* loaded only into the test renderer; these checks do not prove whole-application authenticated browser E2E functionality.

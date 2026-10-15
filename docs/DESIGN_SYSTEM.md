# KestrelMesh: product experience specification

## Product archetype

**Edge control terminal.** This is an independent visual system, not a shared dashboard with a changed accent color.

## Information architecture

Transport status bar → rack index/port lights → primary terminal → dense observation log

## Design rationale

Operators inspect upstreams, throughput/latency where measured, and recovery events in a terminal-like workflow.

## Interaction contract

- Existing authenticated Cloudflare D1 API routes remain unchanged.
- The overview is publicly previewable without exposing private record contents.
- Inspect opens a per-record detail pane; action opens the existing API-backed action form.
- Filter operates on the loaded list and updates card/list records without changing row indices.
- A route change preserves the root credential stored in `sessionStorage`; signing out clears it.
- Desktop and narrow-width layouts use different navigation treatments; scrolling menus preserve all sections.
- User-provided record content is escaped before entering an HTML template.
- The port lights are navigation-decoration, not a fake depiction of live provider status; actual results come from D1.

## Test and deploy requirements

1. `npm run check` checks TypeScript, core UI JS, and `workspace.js` parsing.
2. `npm test` checks escaped user-controlled text, action and inspect hooks, route coverage, existing API contracts, and database migrations.
3. Cloudflare deployment smoke check fetches the **new** `workspace.css` and `workspace.js` and asserts the product's unique shell marker.
4. Preserve the Cloudflare Worker `ADMIN_TOKEN` and scoped API-key controls; no frontend secret is checked into Git.

## Unfinished validation

Full visual regression across Chromium/Firefox/WebKit, keyboard-only audits, screen reader testing, axe accessibility reports, usability testing with real users, full E2E actions against a seeded isolated D1 database and cross-browser responsive evaluation remain required before calling this production-ready.

## Autonomous analysis cockpit — Phase 8

The agent workspace uses the **INFERENCE DIAGNOSTICS** interaction model (`km-terminal`) rather than a generic shared widget. Its session list, report reader, form placement, density, typography, and trace hierarchy are tailored to KestrelMesh. Real metrics reflect persisted D1 sessions and observations. Includes keyboard focus, reduced-motion support, and safe event rendering.

## Autonomous analysis cockpit — Phase 8

The agent workspace uses the **INFERENCE DIAGNOSTICS** interaction model (`km-terminal`) rather than a generic shared widget. Its session list, report reader, form placement, density, typography, and trace hierarchy are tailored to KestrelMesh. Real metrics reflect persisted D1 sessions and observations. Includes keyboard focus, reduced-motion support, and safe event rendering.

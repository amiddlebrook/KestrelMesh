# KestrelMesh — UI quality specification (Phase 6)

This application keeps its independent Phase 5 design language and backend APIs. Phase 6 extends its working interface, not its security model.

## Operator workflows

- Open the **Navigate** control or press `Ctrl+K` / `⌘K`. Search a section, use arrows and Enter, and press Escape to close. On non-input elements, `/` also opens navigation.
- Use a deep link such as `/#overview`, or `/#access`; unknown fragments return to the overview. The browser back/forward buttons follow navigation history.
- **Connect workspace** opens an access dialog instead of browser `prompt()`. The root key is checked against `/api/access/me` before saving to session storage. A narrow scoped key may receive 403 for that route, so successful access is verified by its permitted API requests—not by that probe. Password input is masked by default, credentials do not enter URLs, and Disconnect clears the current tab's key.
- Server reachability is observed by a real GET `/api/health` request. This does not imply D1 availability, model accuracy, SLA, or enterprise uptime.
- For a protected record list, search currently loaded records, select a domain filter, sort results, inspect a record with structured fields and a foldable raw payload, or export the filtered visible subset as JSON. Exported data can contain confidential workspace records and must be handled accordingly.

## Acceptance checks

1. Keyboard navigates without trapped focus; pressing Escape closes native modal dialogs.
2. Screen readers encounter meaningful dialog titles, labels, current page state, and live region messages.
3. Record values are HTML escaped before entering the inspector; unexpected record fields remain visible under Additional fields and the original JSON view.
4. Query and sorting operate exclusively on the **currently loaded page**, not over an imaginary full corpus.
5. Health status is derived from actual API response, never a fabricated heartbeat.
6. Live CI verifies `/quality.css`, `/details.js`, `/explorer.js`, `/interaction.js`, production auth and D1 API contracts.
7. Verify manually on desktop and mobile: smallest supported viewport, keyboard Tab order, 200% zoom, system dark/light theme where applicable, blocked clipboard and offline network.

## Known gaps

Browser-level visual regression, axe/Lighthouse scans, assistive-technology tests, design token governance, tenant-aware navigation, SSO and WCAG audit remain unverified. A working UI is not proof of full enterprise readiness.

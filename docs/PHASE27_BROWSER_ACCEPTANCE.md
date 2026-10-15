# Phase 27 — Production browser acceptance

## Release gate
The deploy workflow runs a dependency-free Node 22 Chrome DevTools Protocol script against the **live Cloudflare Worker**, after the authenticated HTTP smoke test and after database migrations. No simulator or local Wrangler service is used for this acceptance step.

- Desktop guest view at 1440 × 900: application identity, nonempty rendering, navigation, runtime JavaScript errors, and screenshot.
- Mobile guest view at 390 × 844: same checks, plus document overflow check and screenshot.
- Authenticated view on #routinglab: injects the existing secret into an **ephemeral browser session**, asserts the rendered application, and makes a real same-origin protected `/api/overview` request.
- Browser launch, render errors, unexpected console errors, absent navigation, missing credentials, and unsafe horizontal overflow fail deployment.
- Only public **guest** screenshots are uploaded. Authenticated screens and secrets are never stored as artifacts. The ephemeral Chrome profile is removed after every run.
- Chrome is invoked from the standard GitHub Actions runner image. No Playwright subscription, external browser grid, paid vendor, or new runtime service is required.

## Boundaries
This checks actual production Chromium browser behavior; Firefox and WebKit are *not* covered. It is a read-only browser acceptance test and does not create production business records. Product-specific state machines continue to have database integration tests. A successful browser release gate does not establish cross-tenant isolation, external security audit, fault-tolerant operations, or unlimited provider quotas.

## Mobile UX refinement
The real production 390px screenshots revealed toolbar crowding. The mobile workspace now uses two compact rows: credential/refresh and sections/readability. Low-value desktop keyboard-mode buttons are hidden only on narrow screens; keyboard shortcuts still work, and the full navigation remains reachable through an accessible modal. Product-specific colors, corner treatments, and main workspaces remain independent. Browser acceptance enforces the mobile utility-bar height.

## Visual color review
Browser screenshots revealed excessive full-surface color tint. The shell, navigation, and data cards now use neutral slate/graphite surfaces. Saturated tones are reserved for interactive focus, model/evaluation signals and operational state. These product-specific overrides do not change business logic.

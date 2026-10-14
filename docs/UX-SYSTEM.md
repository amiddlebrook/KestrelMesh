# KestrelMesh — Visual product system

**Product approach:** Infrastructure terminal

Control plane shows model routing nodes, real recorded latency bars, backend state and circuit status. Registry page adds a dry-run route preview without running an inference request.

**Primary workflow:** Platform SREs: investigate traces and provider isolation. Sample fixture models are clearly distinguishable from Workers AI adapters.

## Experience behavior

- Home view and main task page are independent product-specific modules, not generic mockups.
- Controls route to real database-backed actions. The on-demand actions show errors without inventing backend responses.
- A public read-only preview hides protected data until the operator supplies their admin access key. The API continues enforcing bearer authentication.
- All dynamic source strings are HTML-escaped; rich source text appears in `textContent` or `<pre>` as data.
- CSS is owned by this application, uses browser/system typography, and has no mandatory remote font services or component CDN.
- Desktop layouts and mobile breakpoints serve different widths. Accessibility work still needed includes independent keyboard/screen-reader acceptance testing and WCAG evaluation.
- Browser E2E and production visual-regression baselines are still a follow-on task. Browser automation was unavailable in the current isolated environment, so no screenshot review is claimed.

## Release verification

`npm run check` validates the UI modules. `npm test` exercises product-specific markup contracts, public locked mode, escaped source values, and the existing API integration suites. GitHub Actions additionally validates live static assets (`identity.css`, `experience.js`) plus authenticated D1 API routes following a successful deployment.

# KestrelMesh: readability and mobile usability

Phase 19 raises hardcoded microtype to at least 13px (14px on small screens), and adds persistent Standard / Comfortable / Large text settings. The responsive menu is a native modal dialog, opened only by a user interaction, with a labeled close button, Esc close, return-focus, current route emphasis and keyboard traversal. Every workspace from the product's real navigation is included. Forms and controls have 44px minimum hit heights on mobile. Tables remain horizontally scrollable *within their own region*, never deliberately clipped. Existing app-specific layouts and theme remain unchanged.

The display preference is local-only and does not contain credentials. The access key remains held in the existing session storage mechanism. This is a usability engineering pass, not an accessibility certification. Production browser assistive-technology QA, contrast audit and complete authenticated E2E still require independent verification.

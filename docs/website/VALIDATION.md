# Website release verification - 23 October 2026

## Executed in this environment

- 68 Node tests passed: 46 existing source/helper regressions and 22 new website checks.
- 11 existing Python platform/SQLite fixture checks passed.
- Nine dependency-free TypeScript modules passed strict semantic checking with the
  available TypeScript 5.8.3, including the new routing helper.
- The actual middleware source was transpiled and exercised against mocked Next.js and
  Supabase adapters for public, owner, customer, admin, preview and unauthenticated paths.
  These are behavioral adapter tests, not a running Next.js server or real auth tests.
- Chromium rendered the actual website HTML, CSS and JavaScript at widths 320, 375, 390,
  430, 768, 1024, 1440 and 1920 pixels. No document-level horizontal overflow was observed.
- Stamp increment, reward-ready state, new-demo reset, reset button, design selection,
  all FAQ disclosures, mobile navigation, Escape-to-close, reduced-motion preference,
  no-JavaScript FAQ/navigation behavior and all six owner-signup destinations were checked.
- No JavaScript page errors were reported in those local rendered-page checks.
- Source, asset, manifest and ZIP integrity were checked before packaging.

Browser navigation to even local HTTP addresses is blocked by this environment's browser
policy. The browser tests therefore rendered the local HTML/CSS/JS in memory. They do not
verify Next.js middleware/static-file delivery, live CSP delivery, Vercel headers or DNS.
The CSP's no-inline-script contract and public routing were checked separately in source
and adapter tests.

## Not verified here - still required before public launch

- The full application Next.js build/typecheck with its pinned dependency tree. The
  registry could not be resolved from this environment, so dependency installation was
  unavailable. No dependency versions or lockfile were changed to work around that.
  The repository's CI still runs the real Next.js build with the pinned packages.
- Hosted Vercel routing, cache/response headers and custom-domain assignment.
- Real phone/email OTP, owner registration, business approval or live database operations.
- Actual iPhone/Android devices and Safari. Chromium viewport checks are not device tests.
- A fresh PGlite/Deno/Flutter suite in this environment. Their application code and database
  migrations are unchanged by the website release; the existing CI jobs remain enabled.
- Existing legal drafts, support details, dependency advisories and outstanding native
  wallet integrations are not certified by these website checks.

This is a complete website implementation for preview deployment and production
verification, not evidence that the full Brewistan service is already production-approved.

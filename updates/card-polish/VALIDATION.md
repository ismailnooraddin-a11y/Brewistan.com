# Card polish validation - 25 October 2026

## Executed successfully
- 28 new presentation and integration-contract checks: actual wallet full-name fields, legacy fields, per-cafe last-stamp dates, null/invalid data, balanced stamp rows, identical compact/full card rendering, vector stamp styles, name wrapping/bidi isolation, localized labels, Bespoke-only scene resolution, black defaults, custom-path validation, tenant isolation, downgrade behavior, preview-render removal, background preservation on card-colour saves, QR separation and installer scope.
- All 68 existing Node source/helper/website checks (audit-checks.mjs, final-checks.mjs, website-checks.mjs). Combined total: 96 passing Node tests.
- All 11 existing Python SQLite/platform-fixture checks; these are not native Flutter or production-database tests.
- Existing nine dependency-free modules passed their strict helper type check. The new card-presentation.ts also passed strict TypeScript checking with the DOM/ES2022 libraries.
- 35 Chromium component-render/layout checks: detail, black fallback, long names/12 stamps, Arabic/20 stamps, and a five-card wallet, at widths 320, 360, 375, 390, 430, 768 and 1440 px. No horizontal document/card overflow in these fixtures; the selected scene and demo QR images loaded.
- Visually inspected the detail, five-card wallet and long-name/narrow-screen screenshots.
- Five installer safety checks: preserves newer QR code and auth/routing/backend files; removes a simulated old preview banner; second installation is byte-for-byte idempotent; updated manifest verifies; unfamiliar source and altered payloads both fail before application writes.
- Package extraction/application followed by the complete 96-test Node suite and project manifest verification.

## What these checks do not establish
- The browser fixtures render markup from the actual TSX card components with mocked customer/context data; they are not a mounted React 19/Next.js production app. The card/page CSS modules are the supplied code; fixture-only header utilities were generated using the available Tailwind compiler. The production project's Tailwind version and dependencies were not changed.
- The QR in visual fixtures is explicitly invalid sample data. No live stamp, redemption, OTP, device registration or signing operation was performed.
- A full Next.js build, full project semantic typecheck, real Supabase upload/publish, and real-iPhone validation remain to be run in Codespaces/staging. Offline npm installation failed with ENOTCACHED because required dependencies are not available in this environment.
- No production database, subscription, Storage data, deployment, DNS, secret or GitHub branch was changed.

## Source used and installation safety
The latest supplied complete archive (brewistan-website-complete-2026-10-23.zip) was used as the executable integration fixture. The screenshot-only scene preview changes were not available as source. Therefore the delivered ZIP is a syntax-aware targeted installer, not an older complete source tree that could undo newer fixes. It backs up the current edited files, edits only the rendered CardView return, and retains existing QR generation, device registration, session and wallet-refresh code. Unknown source structures stop with an error instead of silently guessing.

## Background entitlement
A read-only live inspection found Nana's Tea on Signature with no stored scene. This update does not change paid tiers. Black remains the default; the tea-room preset appears only after the cafe is on Bespoke and its owner publishes the scene in Branding. The chosen scene is a public branding asset. The app uses the existing server-protected tier for rendering; no new database constraint is added to arbitrary branding JSON.

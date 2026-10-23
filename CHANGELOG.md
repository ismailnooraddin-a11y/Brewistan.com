## 2026-10-23 — Nana’s Tea premium scene experiment and logo preview

- Nana-only premium detail backdrop uses the supplied tea-room photograph; opt-in test for Signature, automatic for Bespoke. The all-cards list and QR retain the existing fast, scannable layout.
- The owner branding form previews the selected logo immediately, publishes a newly versioned storage path, and handles errors without falsely showing an unsaved logo.
- Added `NANA_SCENE_AND_LOGO_FIX.md` and isolated source checks.

# 2026-10-23 - Integrated public website

- Added a responsive, dependency-free public marketing website with an interactive
  stamp demo, three design previews, connected-product diagram, plans and FAQs.
- All public signup calls to action lead to cafe-owner onboarding. Customer and
  barista access remain in their existing QR and owner-assigned workflows.
- Kept the PWA, owner dashboard and admin root routing separate; public landing
  requests no longer need an authentication/database lookup.
- Added fixed post-login destinations for cafe signup, normal owner login and admin
  login. No account roles or approval checks are changed by a signup URL.
- Added marketing-only CSP, canonical/social metadata, a social preview image,
  public-host robots responses, private-host noindex guidance and a sitemap.
- Added 22 website regression tests to CI. No new packages or SQL migrations.
- Added a safe domain-move guide. Current website timings are explicitly targets;
  native OS Wallet passes and plastic cards are explicitly planned integrations.

## 2026-10-23 — Compact premium PWA and reliability repair (source candidate)

- Compact luxury loyalty cards for Classic, Signature, and Bespoke; full card and rotating QR on the detailed view. Native wallet gets a compact list treatment.
- Adds optional verified-email OTP to customer and owner login; verified email can be linked to an existing account, while phone signup remains the initial path.
- Introduces a built-in PWA café QR reader, complete paginated card wallet, active card refresh, QR certificate renewal fallback and account-scoped profile display cache.
- Fixes owner café-switching editor state, barista retry IDs, multi-step setup atomicity, elevated-RPC session guards, long slug names and historical offline campaign selection.
- Addresses several reporting, login provider timeout, notification maintenance and native storage resilience issues; adds database regression scenarios.
- 57 source/fixture tests passed, plus strict checking of 8 dependency-free TypeScript modules; full web/Flutter build, new PGlite migrations, hosted providers, and real devices still require CI and staging. **Not an Apple Wallet/Google Wallet pass implementation.**
- Review [UPDATE_2026-10-23.md](UPDATE_2026-10-23.md) before production deployment.

# Changelog

## 1.0.1 - final follow-up source revision - 2026-10-16

Adds migrations 06-11; the preceding five migrations are unchanged. Implements live-session RLS and device proof/binding, encrypted sensitive local payloads, immutable billing quotes and entitlement history, complete wallet paging and paged owner/admin lists, transactional staff/admin notices, bounded notification workers and metrics, ownership transfer, device recovery and expiry-aware rendering. Mobile release now requires the exact successful CI baseline. Privacy/terms drafts no longer promise immediate erasure of all retained/provider data.

Executed: 46 Node checks, 11 Python fixtures, eight strict standalone TypeScript modules, source/YAML/shell/locale checks. Full-stack runtimes and live integration remain unverified here. See the root report and `docs/final/TEST_RESULTS.md`; run staging before production.

## Audit hardening candidate - 2026-10-16

This is a source revision requiring staging validation, not a tested production release. See `AUDIT_REPORT.md` for 32 grouped findings and `docs/UPGRADE.md` for coordinated rollout requirements.

### Security and data integrity

- Scope scanner authorization to a verified user, active staff membership, branch and registered device.
- Sign and verify offline staff evidence; centrally enforce the device/day redemption allowance.
- Preserve one durable event ID across online timeout and offline retry; serialize duplicate event requests in the database.
- Bind wallet caches, scanner caches and queued work to the correct account; preserve legacy rows rather than guessing ownership.
- Pin in-progress puzzles and earned reward labels to the intended campaign version; tighten redemption timing.
- Replace raw owner activity access with a restricted projection, constrain uploads and strengthen request validation.
- Add atomic OTP reservation/approval and durable per-device notification jobs.
- Enforce signed web session timing, hosted phone-verification prerequisites and safer deletion checks.

### Design and workflow

- Separate preview, pending, confirmed and rejected scanner outcomes; keep final rejection reasons for review.
- Dispose hidden scanner/camera state and relock staff mode after backgrounding.
- Improve small-screen navigation and QR sizing, visible keyboard focus, form errors, upload recovery and numeral handling.
- Preserve the existing product appearance; full browser/native visual and accessibility QA remains required.

### Release and verification

- Add migrations 03-05 without changing migrations 01-02.
- Gate Supabase deployment on the exact successful CI commit; improve secret-file handling and Android signing prerequisites.
- Generate native scaffolding without overwriting existing platform customizations.
- Pin web manifest dependencies to the original lockfile resolutions, preserving transitive versions and integrity values.
- Add 27 executable Node checks, 11 Python SQLite/platform checks and additional database/Flutter regressions.
- Include audit findings, upgrade instructions, test logs, a review diff and a SHA-256 file manifest.

### Breaking upgrade considerations

Older scan/snapshot and unsigned legacy queue formats receive HTTP 426. Drain queues before rollout, keep device data, and reconcile undrained legacy rows under supervision. Configure `WEB_SESSION_SECRET`, both allowed origins and hosted phone confirmation before reopening the service. Full-stack integration suites and real-device QA were not executable in the audit environment.

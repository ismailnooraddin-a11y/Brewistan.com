# Brewistan: intensive audit and revised-source report

**Review date:** 16 October 2026  
**Input:** `brewistan.zip` — 123 files  
**Original archive SHA-256:** `11aa931e7e943d6a5286a558ca83330084ced6b8baa7dcf1a51825add7fe9144`  
**Result:** a patched source revision, not a production-deployment certification.

## Executive assessment

The platform has a useful foundation: separate customer/staff workflows, signed customer QR codes, event ledgers, owner reporting, role-based access controls, and a CI starting point. The most serious gaps were not cosmetic. They were at the boundaries between a client and the server, between one account and the next, and between a network timeout and an already committed transaction.

The revision concentrates on those boundaries. The scanner now separates preview from mutation, persists one event identity, sends signed offline staff evidence and distinguishes pending work from confirmed results. Backend changes strengthen authorization, reward timing and campaign versioning. Notification approval and dispatch use transactional state and durable jobs. Web and mobile source changes improve navigation, feedback and small-screen behavior without replacing the product's visual identity.

**Do not deploy this archive blindly to an existing installation.** It contains three new migrations and an intentionally stricter mobile protocol. Existing unsynced queues and historical campaign terms require care. The full dependency-backed database, Next.js, Deno and Flutter suites were not executable in this environment. The executed checks and the unverified work are separated below.

## Scope and method

I inspected the full uploaded project inventory and traced the important paths across Flutter, Edge Functions, SQL/RLS, the Next.js dashboard, storage, messaging and release automation. The review used source comparison against the preserved original, concrete failure scenarios, cryptographic reference vectors, real execution of dependency-free TypeScript helpers, SQLite schema/query fixtures and release-script fixtures.

No live production database, private cloud account, real phone, WhatsApp account, FCM project, app store or deployment environment was accessed. Source-level design review is not the same as an authenticated browser or native-device visual audit. The original two migrations are retained unchanged; the hardening is additive in migrations 03–05.

## Finding register

The following 32 entries group related defects rather than count every changed line as a separate issue. “Implemented” means source was changed; where the required runtime was unavailable, it does **not** mean the integration has passed.

### F01 · Critical · Scanner authority and privileged helper trust

**Status:** Implemented; integration pending.  
**Source:** `supabase/functions/_shared/scan.ts; migrations/20261016000003_audit_hardening.sql; migrations/20261016000005_device_registration.sql`

**Problem:** A valid customer QR could reach preview/summary work before the correct staff/branch authorization; null-auth privilege logic was too broad, and the staff helper exposed full membership rows.

**Revision:** Authorize active staff and active branch before preview; narrow is_privileged; restrict the staff-row RPC to the service role.

### F02 · High · Branch isolation and branch deletion

**Status:** Implemented; integration pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; 20261016000005_device_registration.sql`

**Problem:** A null branch could broaden an assigned membership, and ON DELETE SET NULL could promote a branch-limited barista to all branches. Cross-tenant branch references were insufficiently constrained.

**Revision:** Require an explicit active same-cafe branch, preserve assignment checks, make branch identity immutable, and restrict deletion while memberships reference the branch.

### F03 · Critical · Invitations activated from unverified phone identity

**Status:** Implemented; hosted configuration required.  
**Source:** `supabase/config.toml; functions/_shared/supabase.ts; migrations/20261016000003_audit_hardening.sql`

**Problem:** The local phone-confirmation setting and signup trigger did not establish verified phone ownership before activating invitations.

**Revision:** Require phone confirmation in local config and Edge authentication; populate profile phones and activate invitations only after verification; reconcile legacy unverified baristas. Hosted Auth settings must be changed separately.

### F04 · High · Offline authorization was not supplied as server-verifiable evidence

**Status:** Implemented; integration pending.  
**Source:** `supabase/functions/staff-snapshot/index.ts; functions/_shared/scan.ts; apps/mobile/lib/services/staff_service.dart`

**Problem:** The server could not rely on the mobile UI alone to prove which staff account, install and branch authorized an offline scan.

**Revision:** Bind signed 72-hour snapshots to staff user and scanner device; include them in queued events; verify scope, scan time and live scanner registration on upload.

### F05 · Critical · Timeout retries could represent the same action with another event ID

**Status:** Implemented; end-to-end pending.  
**Source:** `apps/mobile/lib/screens/staff/scanner_screen.dart; services/local_db.dart; supabase/functions/scan/index.ts`

**Problem:** A timeout does not prove that the server failed to commit. Falling back to a new queued ID could apply another business action.

**Revision:** Split preview from mutation, persist before sending, and reuse one event ID for the online request and every retry. Legacy auto requests now require an upgrade.

### F06 · High · Database idempotency races and mismatched replay context

**Status:** Implemented; database execution pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; functions/_shared/scan.ts`

**Problem:** Concurrent first requests could race before an event row existed. ID reuse across stamp/redemption types or other contexts was not handled consistently.

**Revision:** Add a shared event-ID advisory lock, context checks, cross-type conflict rejection, and service-only lookup of already committed results before live permission rechecks.

### F07 · Critical · Wallet, staff snapshot and queue state were not reliably account-bound

**Status:** Implemented; SQLite fixtures passed.  
**Source:** `apps/mobile/lib/state/app_state.dart; services/local_db.dart; services/sync_service.dart; services/crypto_service.dart`

**Problem:** A later signed-in user could see a prior cache or inherit work whose original scanner identity had not been persisted. Late asynchronous responses could restore old-account state.

**Revision:** Scope caches and records by user; bind device registrations to the account; guard late responses with generation checks; clear visible state on identity change; quarantine unassigned legacy records.

### F08 · High · Offline redemption allowance existed mainly on the client

**Status:** Implemented; database execution pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; apps/mobile/lib/services/local_db.dart`

**Problem:** Client-only daily limits can be bypassed, raced or counted against the wrong install.

**Revision:** Enforce the two-offline-redemptions allowance per scanner device and Baghdad calendar day in a locked server RPC, with an atomic local precheck.

### F09 · High · Reward time/status boundaries and oldest-reward selection

**Status:** Implemented; database execution pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql`

**Problem:** Selecting the oldest status-available reward could choose a time-expired row; issuance/expiry ordering was inconsistent; expiry cron could invalidate a legitimate earlier offline exchange.

**Revision:** Filter automatic selection by issuance and expiry at scan time, reject pre-issuance and exact-expiry scans, and allow an expired-state reward only for a valid earlier offline redemption. Redeemed/voided rewards remain protected.

### F10 · High · An in-progress puzzle could silently adopt new campaign terms

**Status:** Implemented; migration review required.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; functions/wallet/index.ts; apps/mobile/lib/state/models.dart`

**Problem:** Versioned campaign rows alone did not pin the campaign governing a partly completed puzzle or the label of an earned reward.

**Revision:** Store campaign_id on progress, retain those terms until completion, then use current terms for the next puzzle. Return earned reward labels from their own campaign.

### F11 · High · Subscription state was not consistently an earning entitlement

**Status:** Implemented with explicit policy.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; 20261016000004_notification_jobs.sql`

**Problem:** An active cafe status alone did not establish that a trial or paid period was still valid.

**Revision:** Gate new earning and marketing approval/preparation on current entitlement. Preserve redemption of already earned rewards at active cafes. Upload-time entitlement remains a conservative policy needing business approval.

### F12 · Medium · Campaign-version and approval lifecycle races

**Status:** Implemented; database execution pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; functions/admin-review/index.ts; functions/staff-manage/index.ts`

**Problem:** Concurrent version creation and stale administrative updates could race or report success when no row changed. A rejected-then-approved cafe could miss trial initialization.

**Revision:** Serialize campaign versions with a cafe lock, condition state transitions, inspect affected rows, and initialize an unstarted trial when a pending/rejected cafe becomes active.

### F13 · High · OTP throttles were check-then-write operations

**Status:** Implemented; integration pending.  
**Source:** `supabase/migrations/20261016000004_notification_jobs.sql; functions/auth-send-otp/index.ts; functions/push-approve/index.ts`

**Problem:** Concurrent requests could exceed counters; provider failures and missing pepper configuration could create misleading behavior.

**Revision:** Reserve limits atomically, require a sufficiently long pepper, count login and step-up reservations consistently, and mark delivery only after a successful provider call.

### F14 · High · Push approval could race or consume changing approval content

**Status:** Implemented; database execution pending.  
**Source:** `supabase/functions/push-approve/index.ts; migrations/20261016000004_notification_jobs.sql`

**Problem:** Approval needed one transaction for the challenge, content/time binding, attempt count and weekly quota. Dynamic audience counts should not invalidate unchanged approved content.

**Revision:** Bind a stable content/time/audience-rule hash, consume the challenge and approve atomically, persist wrong-code attempts without transaction rollback, and serialize weekly quota decisions.

### F15 · High · Push delivery was not a durable per-device workflow

**Status:** Implemented; provider integration pending.  
**Source:** `supabase/functions/push-dispatch/index.ts; migrations/20261016000004_notification_jobs.sql`

**Problem:** One-shot processing could lose recipients after partial failure or leave a sending campaign stuck. Provider acceptance was presented too strongly as delivery.

**Revision:** Introduce persistent jobs, leases, claim tokens, bounded retries and finalization; distinguish FCM acceptance from delivery; invalidate tokens only for structured UNREGISTERED responses.

### F16 · High · Mute, audience and daily reservation handling

**Status:** Implemented; integration pending.  
**Source:** `supabase/migrations/20261016000004_notification_jobs.sql`

**Problem:** Audience construction needed consistent opt-out filtering and database-side selection rather than a capped client-side fetch. Retried old reservations could cross a calendar-day boundary.

**Revision:** Use SQL NOT EXISTS for mutes, recheck eligibility on claim, protect the daily reservation ledger, skip stale-day marketing reservations, and honor legacy reminder flags.

### F17 · High · Registration retries and notification ownership

**Status:** Partially addressed.  
**Source:** `supabase/functions/device-register/index.ts; migrations/20261016000005_device_registration.sql`

**Problem:** Registration could duplicate an install, fall through from a revoked identity, or leave a physical push token attached to the previous account.

**Revision:** Atomically recover same-key registration, reject revoked same-key renewal, bind supplied IDs to the user/key, deduplicate push tokens and cap active installs at 20. A fresh key with a still-valid session is a separate unresolved revocation problem.

### F18 · High · Customer UUID exposure through owner-readable event tables

**Status:** Implemented; RLS execution pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql; apps/web/app/dashboard/activity/page.tsx`

**Problem:** Pseudonymous screen labels did not prevent owners from directly selecting underlying customer identifiers.

**Revision:** Remove owner raw SELECT access to customer event/reward rows and route owner activity through a projection containing the fields the screen needs, not customer UUIDs.

### F19 · High · Brand assets crossed validation boundaries and could falsely appear saved

**Status:** Implemented; storage integration pending.  
**Source:** `apps/web/app/dashboard/branding/BrandingForm.tsx; migrations/20261016000003_audit_hardening.sql`

**Problem:** SVG/browser acceptance did not match the mobile image path; storage and profile update failures were not equally checked; tenant paths and upload constraints needed server enforcement.

**Revision:** Allow PNG/JPEG/WebP, constrain bucket MIME/size, validate tenant-prefixed paths, check the saved row, and remove a newly uploaded object after a failed database save. Existing legacy assets are not deleted.

### F20 · High · Browser session limits relied on unsigned timestamps

**Status:** Implemented; helper tests passed.  
**Source:** `apps/web/middleware.ts; apps/web/lib/session-policy.ts`

**Problem:** Changing/removing client-held timestamp cookies could restart the supposed idle or absolute session clock. Redirects could also lose refreshed cookies.

**Revision:** Sign the envelope with an independent server secret; bind it to user/session and verified primary-authentication time; enforce idle/absolute limits; preserve response cookies across redirects. This protects dashboard navigation, not every direct Supabase API call.

### F21 · Medium · CORS and request boundaries

**Status:** Implemented; helper tests passed.  
**Source:** `supabase/functions/_shared/http.ts; _shared/crypto.ts; _shared/validation.ts`

**Problem:** A single allowed origin did not cover both dashboards. Methods, JSON shape, malformed encodings and body sizes needed predictable failures.

**Revision:** Use an origin allowlist, native/webhook no-Origin support, POST/OPTIONS restrictions, object-only bounded JSON, generic unexpected errors, UUID checks, strict base64url and consistent QR size limits.

### F22 · High · Pending scans were presented like confirmed rewards

**Status:** Implemented; mobile runtime pending.  
**Source:** `apps/mobile/lib/screens/staff/scanner_screen.dart; services/local_db.dart; services/sync_service.dart`

**Problem:** A locally saved action could look completed before server acceptance, and rejection reasons could disappear with queue cleanup.

**Revision:** Use an amber pending state, retain account-scoped final reasons/history without QR payloads, clear provisional local reservations on rejection, and retain unknown/malformed outcomes for reconciliation.

### F23 · High · Hidden scanner lifetime and unlocked staff mode

**Status:** Implemented; native-device QA pending.  
**Source:** `apps/mobile/lib/screens/home_shell.dart; screens/staff/staff_gate.dart`

**Problem:** IndexedStack retained the scanner on hidden tabs; the staff gate did not consistently relock across lifecycle changes.

**Revision:** Unmount inactive pages, relock on backgrounding/tab return, and guard repeated unlock attempts and callbacks after disposal.

### F24 · Medium · Responsive layout, contrast and accessible feedback

**Status:** Implemented by source review; visual QA pending.  
**Source:** `apps/web/app/globals.css; components/SidebarNav.tsx; dashboard/layout.tsx; apps/mobile/lib/widgets/loyalty_card.dart; widgets/rotating_qr.dart`

**Problem:** Small screens, short sidebars, a fixed QR width, low-contrast gold buttons, long reward labels and absent current-page cues caused avoidable friction.

**Revision:** Add active navigation and aria-current, a skip link, stronger focus styles, 44px primary controls, a scrolling sidebar, flexible main/QR sizing, better card foreground selection and wrapping reward text. This is not an accessibility conformance certification.

### F25 · Medium · Input localization, empty states and error feedback

**Status:** Partially addressed.  
**Source:** `apps/web/lib/validation.ts; app/login/LoginForm.tsx; dashboard/push/PushComposer.tsx; apps/mobile/lib/services/digits.dart; screens/wallet_screen.dart`

**Problem:** Arabic/Persian numerals and native date parsing could reject otherwise valid input. Network errors could look like an empty wallet; placeholder-only form labels and busy-state failures confused recovery.

**Revision:** Normalize numerals, validate Baghdad date/time round trips and the send window, add persistent labels and error/status roles, distinguish stale/error/empty wallet states, and reset busy states on errors. Native Arabic/Sorani copy review remains necessary.

### F26 · High · Deployment did not wait for the exact successful CI commit

**Status:** Implemented; hosted Actions execution pending.  
**Source:** `.github/workflows/deploy-supabase.yml; .github/workflows/ci.yml`

**Problem:** A push could trigger production deployment independently of failing checks. Secret files used a predictable temporary path and incomplete prerequisites.

**Revision:** Deploy only a successful main push CI head SHA, use a production environment and serialized deploy group, validate secrets and create restrictive temporary secret files with cleanup traps. Environment approval rules still require operator configuration.

### F27 · High · Android release signing and scaffold overwrite risk

**Status:** Implemented; script fixtures passed.  
**Source:** `scripts/setup-mobile.sh; merge-mobile-platforms.py; configure-android-signing.py; .github/workflows/mobile-release.yml`

**Problem:** Generating scaffolding in-place risked overwriting source/platform customizations. Post-signing a default release could retain a debug-signing configuration; missing keys did not fail reliably.

**Revision:** Create scaffolding in a temporary directory, copy only missing platform files, remove generated debug signing, require release credentials, configure Gradle signing before the build, and verify the produced bundle signature.

### F28 · High · Payment confirmation lacked an amount floor

**Status:** Implemented; policy/database QA pending.  
**Source:** `supabase/migrations/20261016000003_audit_hardening.sql`

**Problem:** A pending report could extend service without comparing the reported amount with the required plan price and months.

**Revision:** Reject approval below the current tier monthly price multiplied by the reported duration. Historic quotes, discounts, overpayments and manual overrides still need a defined billing workflow.

### F29 · Medium · Manifest/lockfile drift and an initially suspected dependency problem

**Status:** Pinned; current advisory checked.  
**Source:** `apps/web/package.json; apps/web/package-lock.json`

**Problem:** Loose manifests obscured the actual resolved versions. Inspection ruled out the suspected missing current Next.js/sharp patch in the supplied lockfile.

**Revision:** Pin direct web dependency declarations to the versions already resolved in the original lockfile; retain transitive package entries and integrity values. No full registry vulnerability audit was possible.

### F30 · High · Account deletion ownership and partial mutation behavior

**Status:** Implemented; Auth integration pending.  
**Source:** `supabase/functions/account-delete/index.ts; apps/mobile/lib/state/app_state.dart`

**Problem:** Closing a cafe does not remove its owner foreign key; checking only an active owner membership could miss the real deletion blocker. Revoking staff before an Auth deletion failure could leave a partial change.

**Revision:** Check actual cafe ownership and database errors, give accurate transfer guidance, rely on linked membership/device cascades after successful deletion, and block deletion with account-owned pending scans. An ownership-transfer UI and full retention review are not included.

### F31 · High · Stricter server rollout could discard old client queues

**Status:** Implemented fail-safe; operator reconciliation required.  
**Source:** `supabase/functions/sync-upload/index.ts; _shared/validation.ts; apps/mobile/lib/services/local_db.dart`

**Problem:** Old clients may delete final per-event rejections and have no signed account/device proof to recover. Upgrading directly could therefore lose offline work.

**Revision:** Reject legacy queue formats as a whole with HTTP 426, preserve unassigned local rows on migration and never attach them to a new login. Sync before rollout or retain device backups and reconcile under supervision.

### F32 · High · Missing verification depth for a release claim

**Status:** Partially addressed; release gate remains.  
**Source:** `scripts/audit-checks.mjs; audit-platform-checks.py; supabase/tests/audit-regression.mjs; apps/mobile/test/`

**Problem:** The original CI/tests were useful but did not cover enough of the authorization, retry, account-switch and lifecycle boundaries to establish release readiness.

**Revision:** Add repeatable helper, SQLite/script and database regressions. Execute available checks locally; require the full dependency-backed database, Edge, web and Flutter suites in CI/staging before production.

## Important logical traces

### 1. A timeout is an unknown outcome, not a failed sale

Previously, an online request and a later offline fallback could be treated as different events. A response may be lost after the database commits. The replacement flow is: preview without a mutation; choose the action; persist one event and its authorization context in a local transaction; send that ID; retain it on uncertainty; reconcile the same ID. The database serializes competing requests for the ID and checks type, cafe, branch, staff and customer context in its mutation functions.

An already committed result is looked up before current snapshot/revocation checks, so a subsequent permission change does not turn a successful prior transaction into a new mutation. The lookup is restricted to service credentials and the original staff/cafe/branch/type context. It does not create another stamp or reward. This is idempotency for an event, not proof that a real purchase occurred.

### 2. Offline authorization and acceptance are different things

The signed snapshot establishes a staff user, install, branch scope and time interval. It does not make the local device a trustworthy server. A saved scan is provisional; revocation, cooldown, reward state, entitlement and the central daily limit may still reject it. The app now preserves the reason for that decision instead of silently deleting the only useful evidence or showing an unconditional green success.

Offline redemption in the revised app requires the customer's cafe-specific signed reward voucher, including when preparing a redemption while online. That deliberately ensures the persisted request remains verifiable if its response is lost. A generic customer QR can still be previewed; the scanner asks for the reward code before redeeming.

### 3. A campaign version is only useful when progress references it

Keeping old campaign rows is insufficient if every stamp simply reads the active row. The migration adds a campaign reference to an in-progress puzzle, and the wallet returns labels for each earned reward's own campaign. When a puzzle completes, the progress reference resets so the next puzzle can use the latest terms.

For already-existing progress, the migration can only backfill the campaign currently active in the supplied data. It cannot reconstruct an earlier promise that was never recorded. Review partial puzzles against business records before rollout and compensate affected customers when necessary; do not mistake a deterministic backfill for recovered history.

### 4. Approval, dispatch and delivery are separate states

A WhatsApp step-up code authorizes the exact campaign content and time plus the explicit audience rule. Audience membership can naturally change before sending. Approval therefore does not hash a volatile recipient count. Approval and quota consumption are transactional; provider calls remain external.

FCM acceptance is not evidence that a person received, opened or read a notification. The worker now records durable per-device jobs and acknowledgements. A crash after provider acceptance but before acknowledgement can still lead to a repeated message. The delivered-count field is retained for compatibility but is labeled as provider acceptance in the dashboard. The mobile app does not yet implement full delivery-ID deduplication for every foreground/background notification path.

## Business rules made explicit by this revision

The existing two-offline-redemptions-per-scanner allowance is now centrally enforced by Baghdad calendar day. Staff snapshots authorize scan times within their 72-hour period; the upload age bound remains seven days. Scanner revocation is checked at upload, and a revoked staff membership is not treated as still active merely because its historical activation interval covered the scan.

New stamps and new marketing approval/preparation require **current** trial/paid entitlement. Existing rewards can still be redeemed at an active cafe after its subscription expires. This conservative upload-time earning check can reject an offline stamp taken before expiry but uploaded afterwards. A more generous historical-entitlement policy needs explicit billing-period history and should not be guessed from one mutable subscription row.

Registration is limited to 20 active device records per user. Color validation in the dashboard targets 4.5:1 for custom foreground/background selections, but the entire product has not been tested for accessibility conformance. Transactional expiry reminders honor cafe mutes but do not consume the marketing-message daily reservation. Failed or provider-ambiguous sends are not guaranteed to be absent from a user's device.

Payment validation uses current configured plan pricing. The revision does not invent a discounts, quoted-price, credit-balance or refund system. Subscription prices supplied in the original repository remain placeholders until configured by the business.

## Remaining gaps and release blockers

| Priority | Gap | What must happen next |
| --- | --- | --- |
| Blocker | Full-stack build and database behavior are unverified here. | Run the complete CI suite and staging checks, apply all migrations on a restored production-like copy, and inspect any failures before release. |
| Blocker for upgrades | Old queues have no trustworthy account/device/snapshot proof. | Sync before rollout where possible; preserve device data and reconcile remaining legacy records under supervision. Never manufacture ownership or silently drop them. |
| High | Historical campaign and subscription promises may not be reconstructable. | Review existing partial progress and decide the offline-at-expiry policy. Add immutable entitlement/quote history for a less conservative implementation. |
| High | Pagination and scaling are incomplete. | Wallet/campaign/history fetches still need explicit pagination or bounded purpose-built RPCs; customer listing and latest-50 activity are not a complete export. Test datasets above the configured PostgREST row limit. |
| High | A valid bearer session may enroll a fresh device key after a previous key was revoked. | Define device trust, recent-authentication requirements and session revocation together. Same-key renewal protection is not an attestation system. |
| High | Offline clocks, rooted clients and colluding authorized staff remain fraud risks. | Add anomaly review, operational controls and, where required, a verifiable point-of-sale reference. A signed QR proves key possession, not payment. |
| High | Notification throughput and exactly-once presentation are not solved. | The current worker claims 25 jobs per invocation. With the repository's five-minute schedule, that is at most 300 device jobs/hour before retries; capacity testing and scheduler/worker tuning are required. Implement client deduplication where appropriate. |
| High | Not every mutation and audit message is one transaction. | Move important admin/staff state transitions plus their audit records into SQL RPCs or an outbox. Several WhatsApp/admin notices remain best-effort. |
| High | Production operations need evidence, not just scripts. | Configure alerts, retention, encrypted backups and restore drills; review secret rotation, key rollover, log redaction and incident procedures. Pending QR data still resides in local SQLite rather than a purpose-built encrypted database. |
| Medium | Hard browser limits do not replace API session policy. | The signed middleware cookie gates dashboard navigation; direct Supabase clients still operate under their JWT/RLS policies. A strict universal idle policy needs a server-mediated/API design. |
| Medium | Ownership transfer, billing exceptions and retention policy lack complete workflows. | Provide tested support/admin processes and review privacy/terms with appropriate local advisers. Linked memberships/devices already cascade on account deletion; do not claim unrelated provider or backup data disappears automatically. |
| Medium | Complete Arabic/Sorani and native accessibility review is outstanding. | Review all new status/error strings, large text, screen readers, camera permissions, biometrics, focus order, foreground/background behavior and cached expiry states on real devices. Some new copy still falls back to English. |
| Medium | Toolchains and remote infrastructure still drift. | Commit a tested Flutter lockfile/platform baseline and pin a validated CI/Supabase toolchain. No npm advisory audit or provider integration certification was possible here. |

## Verification actually executed

**27 Node automated checks passed.** They run the actual transpiled dependency-free helpers, plus source/import/lockfile checks. Coverage includes RFC 8032 Ed25519 vectors, token tampering and size bounds, QR window and exact-expiry behavior, voucher user/type/expiry binding, fixed-length OTP output, SHA-256, CORS, method restrictions, JSON/body limits, UUID parsing, Arabic/Persian digits, Baghdad date validation, contrast math, signed session expiry/tampering and legacy queue upgrade rejection. The syntax pass covered 73 TypeScript/TSX files.

**11 Python SQLite/platform checks passed.** They exercise extracted SQLite create/upgrade statements, legacy queue preservation, account filtering and in-flight delay, transaction rollback, device/day count behavior, result-history shape, isolated scaffolding, both Gradle dialects, signing prerequisites and selected workflow/shell invariants. These are fixtures, not the Dart sqflite runtime or a Gradle build.

**Five standalone TypeScript modules passed strict isolated type-checking** using TypeScript 5.8.3 with a small Deno environment declaration. This does not type-check the dependency-backed Next.js or Edge application. **Four workflow YAML files and 22 embedded shell blocks parsed**, and the shell setup script passed `bash -n`.

Database regression cases were added for phone verification, null-auth privilege, branch boundaries, campaign pinning, replay context, subscription gating, registration, offline caps, reward timing, OTP attempts and stale notification acknowledgements. They were **not run**: PGlite could not be installed because dependency fetching failed with a DNS-resolution error. The same environment lacked Flutter/Dart, Deno, Supabase CLI and a PostgreSQL server, and did not have the web project's installed dependencies. Full web build, mobile analysis/tests, native lifecycle/visual QA, database/RLS/concurrency execution, hosted Auth, storage, messaging and deployment tests remain pending.

No authenticated app browser session or native visual snapshot was generated. Design changes were assessed from layout, component and style code; this report does not claim a completed visual acceptance pass.

See `docs/audit/TEST_RESULTS.md` and the included raw logs for exact commands and boundaries. “All checks passed” in those logs refers only to the named local checks.

## Delivery contents and rollout decision

The archive contains the revised source, the original two migrations, three incremental hardening migrations, new regression checks, `docs/UPGRADE.md`, this report, a change patch, test evidence and a SHA-256 file manifest. No credentials, generated keystores, dependency directories or font binaries were added.

The recommended decision is **staging first, production only after the release blockers are cleared**. Preserve the original archive, back up the database and affected devices, and follow the documented compatibility sequence. If a migration fails, stop; do not delete migration history or compensate by bypassing authorization. Restore the staging snapshot, resolve the failure and rerun the complete migration chain.

## External references and dependency correction

[1] Next.js, “Next.js Security Update: October 14, 2026”: https://nextjs.org/blog/nextjs-security-update-october-14-2026 . The supplied lockfile already resolved Next.js 15.5.28 and sharp 0.35.5, which are the versions named in that update. The revision does not claim to have newly patched those dependencies. Applicability of individual advisories depends on actual feature use and deployment.

[2] Supabase local configuration, phone confirmation setting: https://supabase.com/docs/guides/local-development/cli/config . A repository setting is not evidence that the hosted project's setting is already enabled.

[3] Supabase JWT fields, including session and authentication-method claims: https://supabase.com/docs/guides/auth/jwt-fields . The browser envelope uses primary-authentication time; refreshing a token or performing MFA does not intentionally reset the absolute primary-authentication clock.

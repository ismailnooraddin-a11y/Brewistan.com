# Upgrade and staging runbook

**Revision:** audit hardening, 16 October 2026. **Status:** patched source candidate; not a production certification.

Read `AUDIT_REPORT.md` and `docs/audit/TEST_RESULTS.md` before using this revision. Do not overwrite a live database, run a production reset, or treat passing helper tests as a migration dry run.

## 1. Preserve the installation and reconcile old mobile work

Back up the database, storage metadata and objects, deployment configuration, and the original source revision. Test restoration to a separate project. Preserve the existing platform signing seed and public key: silently replacing them invalidates already issued certificates and offline evidence. Never commit production secrets to this archive.

Before changing the server, arrange a controlled scanning/notification maintenance window. Bring existing scanners online and drain their queues on the **old compatible backend**. Confirm their results centrally. Retain app/device data for every scanner that cannot complete this step. Do not uninstall the app or clear its storage as a troubleshooting shortcut.

The revised protocol intentionally refuses old scan `auto` requests and staff-snapshot requests without a scanner device ID. The sync endpoint returns HTTP 426 for an entire legacy-format upload before producing per-event terminal statuses. This is a fail-safe against older apps dropping their queued rows; it is not an automatic data conversion. The mobile SQLite migration preserves legacy rows without assigning them to whichever account logs in next. Those rows lack trustworthy staff/device/snapshot context and require supervised reconciliation. A complete legacy-queue recovery UI is **not** included.

Deploy an updated mobile client as part of the coordinated rollout. Its first account-scoped bootstrap needs an online connection to register the device and refresh the signed staff evidence. Do not reopen scanning on unsupported app versions.

## 2. Configure a production-like staging project

Use isolated test credentials and test provider destinations. Configure both dashboard hosts and a real test phone verification path. On the **hosted Supabase project**, enable phone confirmation explicitly: the local `supabase/config.toml` setting alone does not configure a remote Auth project. Review existing unverified profiles and invited/active staff; the migration removes unverified phone identity from profiles and reconciles affected barista invitations.

Required server-side configuration includes:

| Setting | Action |
| --- | --- |
| `PLATFORM_SIGNING_SEED` | Preserve the current installation's seed; use a separate seed only for a separate test installation. |
| `OTP_HASH_PEPPER` and `CRON_SECRET` | Supply independent random secrets, each at least 32 characters. Changing an OTP pepper invalidates outstanding challenges. |
| `WEB_SESSION_SECRET` | New, required, server-only web secret of at least 32 characters. Do not prefix it with `NEXT_PUBLIC_`. Existing web sessions may need fresh sign-in. |
| `ALLOWED_ORIGINS` | Comma-separated exact origins, including both owner and admin hosts; no trailing path. |
| `APP_ENV` | Set to `production` outside intentional local development. |
| `WHATSAPP_DEV_LOG` | Keep false/unset in production. Development logging now also requires `APP_ENV=development`. |
| Messaging and push credentials | Configure the existing WhatsApp, SMS-hook, optional fallback and FCM credentials; test without contacting real customers. |

The original web lockfile already resolved Next.js 15.5.28 and sharp 0.35.5. This revision pins manifests to the supplied resolutions; it does not claim a new security upgrade. Install web dependencies with `npm ci`. Resolve Flutter dependencies with a working SDK, review them, and commit a tested app lockfile and native project baseline before a reproducible release. The archive does not invent a Flutter lockfile it could not resolve.

## 3. Apply additive migrations in order

The original migrations `20261016000001_core.sql` and `20261016000002_storage_cron.sql` are unchanged. On staging, apply:

1. `20261016000003_audit_hardening.sql`
2. `20261016000004_notification_jobs.sql`
3. `20261016000005_device_registration.sql`

Do not mark migrations applied without executing them. Review the migration output and data changes on a restored, representative dataset. Deploy the revised Edge Functions **after** their required database functions exist. Coordinate client availability and the maintenance window because the older and newer scanner protocols are intentionally not interchangeable.

Before approving the data changes, explicitly review:

- **Partial puzzles:** their campaign reference is backfilled from the current active campaign. Historical promises that were never stored cannot be reconstructed. Reconcile or compensate affected customers using business records.
- **Entitlement and billing:** new stamps/marketing require current valid trial or paid entitlement. A stamp made before subscription expiry but uploaded later can be rejected. Reward redemption still works at an active cafe after subscription expiry. Payment approval uses the current plan price; discounts and historical quotes need a defined process.
- **Branch references and device inventory:** branch deletion is restricted while referenced; device registration is limited to 20 active records per user. Do not work around these by broadening staff membership or clearing revocations.
- **Old notification campaigns:** existing `sending` campaigns remain dispatch version 1. Inspect provider/audit history and reconcile them manually. Do not mass-reset them to scheduled or resend them blindly; the old one-shot delivery state does not prove which devices received a notification.

The new dispatcher uses durable jobs and bounded retries, not guaranteed exactly-once delivery. Provider acceptance is not a read receipt. At its default batch of 25 jobs per five-minute run, theoretical throughput is roughly 300 device jobs per hour before retries; assess capacity before sending to a large cafe audience.

## 4. Run all checks before production

Run these from a fresh checkout with the required tools and network access:

```bash
# Dependency-backed database harness, including added regressions.
(cd supabase/tests && npm ci && npm test)

# Actual Edge runtime checks. Use the CI test environment for the QR tests.
deno check supabase/functions/*/index.ts
SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test   deno test --allow-env supabase/functions/_tests/

# Helper checks plus actual Next.js build.
(cd apps/web && npm ci)
node --test scripts/audit-checks.mjs
python3 scripts/audit-platform-checks.py
(cd apps/web && npm run typecheck && npm run build)

# Native platform generation is non-destructive, but still inspect its diff.
bash scripts/setup-mobile.sh
(cd apps/mobile && flutter analyze --no-fatal-infos && flutter test)
```

Provide the documented web environment variables and server-only session secret to staging. Run migrations and permissions tests on actual PostgreSQL/Supabase as well as the PGlite fixture. Validate behavior under real authenticated/service roles, not only a privileged test connection. Exercise concurrent requests from independent database sessions. These full checks were **not run** in the audit environment.

## 5. Required staging acceptance scenarios

Use at least two cafe owners, two customers, two staff users, two branches and multiple installs. Test real owner and admin hostnames, including the admin MFA flow.

| Area | Acceptance criterion |
| --- | --- |
| Authorization | A customer, unverified invited phone, wrong-branch staff user and other cafe owner cannot use scanner authority or read another tenant's records. |
| Unknown online outcome | Force a timeout after database commit. Retry and background sync reuse the same event ID and produce only one business action. |
| Offline evidence | Modified/expired staff evidence, wrong device, wrong branch, revoked staff/device and a mismatched customer voucher fail safely. |
| Queue isolation | Switch accounts while a wallet fetch, registration and sync are in flight. Old responses do not replace the new account's state; old queued work is not uploaded as the new user. |
| Offline daily cap | Two qualifying redemptions on a device/Baghdad day are accepted; a third is rejected centrally. Duplicate retries do not consume another slot. |
| Reward terms | Change the active campaign mid-puzzle; finish using the original terms, then start the next puzzle on the new version. |
| Reward timing | A scan before issuance or at/after expiry is rejected; a legitimate earlier offline redemption remains eligible even if an expiry job ran before upload. |
| Push approval | Wrong OTP attempts persist, challenge replay/content edits fail, and simultaneous approvals cannot exceed the campaign quota. |
| Push delivery | Test mutes, revoked/reassigned FCM tokens, provider failure, lease expiry, stale acknowledgement and crash-after-acceptance. Confirm that the UI says provider acceptance rather than guaranteed delivery. |
| Privacy and deletion | Owners receive the safe activity projection, not raw customer identifiers. Cafe owners get transfer guidance; failed Auth deletion does not preemptively revoke staff. |
| Native UX | On actual iOS/Android, test camera disposal, background relock, pending/rejected feedback, QR scanability, 320/360-pixel layouts, large text, keyboard and screen reader. |
| Web UX | Test narrow and short viewports, keyboard focus, active navigation, long cafe/reward names, image upload errors, session expiry and both administrative host flows. |
| Languages | Have native speakers review Arabic and Sorani, RTL layout, numeral conversion and the remaining English fallback messages. |
| Release | Build with real staging release credentials; confirm Android bundle signing and an iOS archive with correct entitlements and push configuration. |

## 6. Release gates, operations and rollback

Configure GitHub's `production` environment with appropriate approvals and branch restrictions. The Supabase workflow consumes the exact successful `CI` main-push SHA and serializes production deployments; the YAML cannot itself create human approval policies. The manual mobile release should use the same CI-approved commit. Vercel's independent auto-deployment settings must also be gated or paused by an operator during coordinated migrations; the Supabase workflow does not control them.

Confirm scheduled jobs are enabled only for the intended environment, provider credentials work, secrets are not exposed in logs, and failed/pending jobs are observable. Establish support ownership for rejected scans, stale queues, payment disputes, privacy requests and legacy campaigns. Do not call the release complete until the full test evidence and migration review are recorded.

No automatic inverse migration is supplied. Restoring old application code alone is not a safe database rollback. Rehearse restoration of the pre-upgrade database and compatible app/function revision; account for transactions and provider messages created after the backup. Preserve event/audit evidence during any reconciliation. Never edit already-applied migration history or reset production to make tests pass.

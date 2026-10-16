# Brewistan 1.0.1 - installation and upgrade runbook

**Scope:** this final revision adds migrations 06-11 to the prior review's 01-05. The first five migration files are unchanged. No production database has been migrated here. Work on a disposable restored staging copy before scheduling a production change.

## 1. Preserve the existing state

Back up the database, Auth configuration, Storage policies/assets, currently deployed application/functions and affected mobile devices. Verify that the backup can actually be restored. Record the migration history and deployed commit. Protect backups as sensitive data; a source ZIP is not a data backup.

Drain scanner queues using the compatible old backend before upgrading wherever possible. Do not clear app storage, uninstall, revoke a scanner or rotate its key merely to get rid of a queue error. Old unsigned/unassigned records must stay quarantined for reviewed reconciliation; this version does not guess their account or forge new evidence.

Migrations 01-05 must match the previously applied files. For an installation still on the original 01-02, apply 03-11 in order after the same compatibility review. For a new empty project, apply 01-11 once. Do not replay old migrations manually or mark an unapplied migration as complete.

## 2. Resolve historical decisions before cutover

Existing in-progress campaigns only retain the terms actually recorded. Review old promises against external records where necessary. Entitlement history begins with the period observed by migration 07; it does not invent a past start date. Evidence-backed earlier periods can be added with `admin_record_entitlement` under an authenticated MFA-admin session and a reason.

Legacy pending payments without quote IDs need explicit administrator reconciliation before approval. Standard new payments must be reported against an unexpired quote for the exact amount; custom quotes are available on the admin Operations page. Check duplicate historical references before confirming service.

Review old `sending` marketing campaigns and unresolved provider outcomes. Do not blindly reset and resend a campaign that may already have reached recipients.

## 3. Configure staging

Use separate staging Supabase, provider credentials and safe test recipients. Require hosted phone confirmation; local `config.toml` is not proof of hosted settings. Enable admin TOTP. Set the documented Auth hook, signing seed, independent OTP/cron secrets, both allowed dashboard origins and the server-only web session secret. Fill private copies of the supplied example configurations. Do not print live OTPs or enable development logging in production.

Check that the hosted Auth schema supports `auth.sessions(id,user_id,created_at,not_after)`. Migration 06 deliberately denies a signed-in API request whose session does not exist or is revoked. Test service-role maintenance separately from authenticated REST/RLS access. These migrations assume Brewistan's dedicated schema; review the restrictive policy loop against unrelated public tables in a shared database before applying it.

## 4. Execute the full build and database checks

```bash
# Required: Node/npm, Python, Deno, Flutter, network access and configured web environment.
bash scripts/verify-all.sh

# Optional source/YAML/locale verification (requires PyYAML):
python3 scripts/verify-source.py
```

The command runs locked web and database dependency installs, helper tests, strict helper checks, SQLite/script fixtures, PGlite regressions, Deno checks/tests, Next.js type-check/build and Flutter analysis/tests. It does not replace actual PostgreSQL/Supabase migration tests or real-device validation. Apply all pending migrations on the restored staging database and run the acceptance cases below with real roles and independent concurrent sessions.

CI records `pubspec.lock` and the tested Flutter version after its mobile tests. The mobile release workflow requires a successful main-push CI run for exactly the selected commit, downloads that baseline, rejects lockfile drift and repeats mobile checks. The artifact is retained for 30 days; rerun CI if it has expired. The first CI resolution still needs review. Commit the reviewed lockfile and generated native platform files for subsequent maintenance.

## 5. Coordinate deployment

Use a maintenance window or controlled roll-out; do not mix arbitrary client and server versions. New registration requires a signed proof and session binding, so old clients cannot be assumed compatible. The old queue format fails as an entire request with HTTP 426 to prevent per-item destructive cleanup.

Pause independent hosting auto-deploys and production marketing scheduling during cutover. Apply migrations in order, deploy the matching functions, deploy the matching web application and distribute the matching mobile build. Configure GitHub's production environment approvals and branch restrictions: the YAML does not create these controls. Backend deployment is gated on the exact successful main-push CI SHA. Gate the separate web hosting service as well.

Require fresh web authentication after the session-policy cutover. Existing registered mobile keys can migrate with valid key proof; a new key needs a recent primary sign-in. Preserve pending account-bound queues during all sign-out/update paths. Never include private keys or service-role credentials in a mobile build.

Only enable scheduled sends after dry-run and recipient/provider checks. The schedule starts four leased workers every five minutes, but real throughput depends on provider limits, queue preparation and platform runtime. Inspect the returned operational counts and the MFA-admin Operations page.

## 6. Acceptance scenarios that must pass

| Area | Required evidence |
| --- | --- |
| Authentication/RLS | Unverified, expired, blocked and wrong-tenant sessions cannot read or mutate protected records through Edge or direct REST; admin operations require AAL2. Missing MFA claims fail closed. |
| Device trust | Valid registration proof succeeds; modified account/session/key/token/timestamp fails. Revoking a linked device blocks that session, including fresh-key attempts. Test migrated unlinked sessions separately. |
| Session limits | Enroll a web session, cross idle/absolute deadlines, delete/change cookies and try direct authenticated RPC/REST. Expired records must not be revived by that activity. |
| Scanner retries | Force timeout after commit; retry the same event immediately and after its upload window. The original result is returned without another stamp/redemption. New over-age requests are rejected. |
| Offline rules | Exercise snapshot expiry/scope, signed voucher timing, revoked staff/device, two-device races and the two-offline-redemptions/Baghdad-day limit. |
| Accounts and local encryption | Switch users during wallet, registration and sync requests. Test fresh install, legacy upgrade, bad ciphertext, wrong associated data and missing secure-storage key. No other user's queue uploads or plaintext fallback is allowed. |
| Rewards/subscriptions | Change a campaign mid-puzzle; test exact reward expiry and an offline scan inside a recorded entitlement uploaded after its end. Unrecorded history requires support evidence, not automatic credit. |
| Billing | Price changes after quoting, wrong amounts, duplicate references, repeated approvals, preserved trial/paid time, custom discounts, legacy reconciliation and a changed plan tier. |
| Transfer/deletion | Owner request, wrong-recipient rejection, recipient acceptance, MFA completion, old-owner access removal, cancelled campaigns and deletion of a former owner with retained ledgers. |
| Lists | More than 1,000 wallet/customer/history records, literal searches, empty pages, deleted/inserted rows between pages, and an oversized staff scope that must fail explicitly rather than silently truncate. |
| Messaging | Mutes, token reassignment, expired leases, stale acknowledgements, retry exhaustion, crash after provider acceptance, parallel workers and account-specific mobile deduplication. |
| Interface | Real browser/iOS/Android viewports, camera disposal, biometric errors, app background/foreground, long names, large text, screen readers, RTL and native Arabic/Sorani wording. |
| Operations/release | A verified Android signature, appropriate iOS signing/entitlements, real staging OTP/FCM/APNs, meaningful failure alerts and a timed restore rehearsal. |

## 7. Rollback and reopening

If a migration fails, stop and inspect the database transaction/migration state. Do not bypass authorization, delete migration history or reset production to force progress. Restore the staging snapshot, correct the cause and repeat the entire sequence.

There is no automatic inverse migration. Restoring old application code alone is not a safe rollback of new session/quote/queue rules. Rehearse restoring a compatible database and app/function revision, then reconcile transactions and external messages created after the backup. Keep audit and local queue evidence. Reopen production only with recorded full-stack, provider and device acceptance and an assigned incident owner.

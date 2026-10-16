# Brewistan 1.0.1 - final revised-source report

**Prepared:** 16 October 2026. **Input:** `brewistan_reviewed_fixed.zip`, itself based on the original `brewistan.zip`.

**Delivery status:** complete revised source bundle; not a deployed service, signed mobile binary, or certification that every runtime path is correct. The original archives are unchanged. This report supersedes the remaining-gap statements in the initial audit where a replacement is described below. The original report and evidence remain under `docs/audit/` as historical records.

## What changed in this final pass

The earlier revision addressed 32 groups of authorization, retry, reward, notification, privacy, design and release defects. This pass implements further source fixes for the outstanding engineering gaps. It retains the first five migrations unchanged and adds six migrations, numbered 06-11. Changes are source-implemented unless a specific executed check is identified; database and native integration were not executable here.

| Gap | Final source change | Main implementation |
| --- | --- | --- |
| Revoked bearer sessions could keep making direct API calls | Session existence, revocation and web deadlines are checked in server helpers and restrictive RLS policies; device enrollment is bound to a live session and proof of its key. | Migration 06, shared authentication, middleware |
| A revoked device could change keys under the same linked session | Enrollment uses a per-user lock, session/key binding, recent-primary-login checks and an Ed25519 proof binding the account, session, key, platform, device, token and timestamp. Revoking a device blocks its linked sessions. | Migration 06; device-register; mobile DeviceKeys/AppState |
| Browser cookies were not the entire API session policy | Database-backed web session records enforce the same 2-hour idle and 12-hour absolute limits even for direct authenticated API access after enrollment. Browser activity updates the database record; direct API activity alone does not keep it alive. | Migration 06; web middleware |
| Pending QR and signed staff data were plaintext in SQLite | AES-256-GCM encrypts queued QR/snapshot payloads and sensitive account caches with a secure-storage key and record/account-bound associated data. Migration preserves queued work. Loss of a key fails closed rather than deleting records. | PayloadCipher, LocalDb, bootstrap recovery |
| A delayed offline stamp could lose an otherwise valid subscription entitlement | Append-only observed entitlement intervals and an audited correction path allow eligibility at scan time, within the existing age bound. New stamps still require current entitlement. | Migration 07; process_stamp |
| Prices could change between payment and review | Immutable quotes record the tier, duration, required amount, reason and deadline before reporting. Exact-amount checks, normalized reference reuse protection and idempotent approval use that quote, not the current price table. | Migration 07; owner billing UI |
| Discounts and legacy payments lacked an explicit process | MFA administrators can create reasoned support quotes and reconcile eligible legacy reports. Duplicate confirmed references are also checked at approval. There is no invented refund or credit-balance ledger. | Migration 07; admin payment actions; Operations support form |
| Large wallets and lists could silently truncate | Wallet keyset pages and server-computed totals, safe owner list RPCs, 50-row dashboard pages, deterministic ordering and complete-cache updates replace silent capped reads. Staff snapshots use a purpose-built SQL aggregate. Oversized snapshots fail explicitly. | Migration 08; wallet/staff Edge functions; dashboard pages |
| Critical staff/admin changes and their audit logs were separate operations | Staff invitation, removal, confirmation and cafe approval/rejection now commit with audit records and durable WhatsApp notice jobs in the same database transaction. | Migration 09; staff-manage/admin-review |
| Notification processing was a single tiny batch | Deadline-aware repeated batch draining, bounded parallel provider work, four scheduled workers, leased outbox jobs and operational counts replace the one-batch bottleneck. No unmeasured throughput or delivery guarantee is claimed. | Migrations 09-10; worker; push-dispatch; scheduler |
| Retry delivery could trigger duplicate client effects | Stable delivery IDs, Android tags/APNs collapse IDs and account-bound persisted mobile deduplication protect eligible callback paths. The operating system can still display duplicates in some acceptance/crash scenarios. | Messaging and PushService |
| A replay older than seven days could reject a previously committed action | Existing-event lookup occurs before rejecting the age of a new upload, retaining the original outcome of an already committed event. Uncommitted over-age events still fail. | Shared scan and sync-upload |
| Ownership transfer blocked legitimate account deletion | A current-owner request, verified-recipient acceptance and MFA-admin completion atomically replace ownership, audit the decision and cancel old marketing authorizations. Historical creator/reporter references allow account removal. | Migration 11; owner/recipient/admin pages |
| Device revocation/recovery lacked a complete interface | Settings expose devices, explicit revocation warnings, safe sign-out and a recovery path that preserves queued work and requires a fresh primary login for a new key. | DevicesScreen, AppState, DeviceKeys |
| Expired cached rewards and local clock changes could mislead the scanner/customer | Periodic expiry-aware rendering, voucher expiry checks, trusted-time certificate checks and monotonic clock-change detection strengthen the existing offline safeguards. | Wallet/QR widgets; TimeService |
| New status copy lacked language keys | The main mobile UI dictionaries now have 82 matching keys in English, Arabic and Sorani, including pending work, recovery and deletion warnings. Native-speaker review and remaining server-error/English web copy are not certified complete. | Mobile strings and source verifier |
| Manual release could use a different mobile resolution from CI | Mobile release requires successful main-push CI for the exact commit, downloads its tested Flutter version and pubspec.lock, rejects dependency drift and repeats analysis/tests before building. | CI and mobile-release workflows |
| Privacy/terms promised more than the implementation delivered | Pre-launch drafts now distinguish profile deletion from retained ledgers, providers/backups, offline pending status and support processes; they visibly require operator approval instead of asserting compliance. | Privacy and terms pages |

## Verification performed on this export

**46 Node automated checks passed:** the original 27 plus 19 added helper/protocol/source checks. These execute dependency-free helpers and verify protocol signatures, queue-draining behavior, timestamp boundaries, page parsing, request/session guards, imports and selected source invariants. The syntax pass parsed **83 TypeScript/TSX files**. Source-pattern assertions are not runtime security tests.

**11 Python SQLite/platform fixture checks passed:** fresh and legacy queue schema, account filtering, rollback, device/day counts, retained result reasons, safe platform merging, signing prerequisites and shell/migration lexical checks. These run real SQLite fixtures and script behavior, not the Dart sqflite or Gradle runtimes.

**Eight dependency-free TypeScript modules passed strict semantic type-checking** with TypeScript 5.8.3 and a minimal Deno.env declaration. The pinned web compiler is resolved separately by npm CI; this local result does not replace its dependency-backed build.

**Additional checks:** four workflow YAML files parsed; 28 embedded shell blocks passed `bash -n`; nine JavaScript modules passed `node --check`; JSON parsing and 82-key mobile locale parity passed. Archive, input preservation, migration hash and final manifest checks are recorded separately in `BUNDLE_INFO.json` and the delivery verification.

See `docs/final/TEST_RESULTS.md` and `docs/final/logs/` for commands, raw outputs and limitations. Earlier intermediate logs remain labeled by their filenames and are not the final acceptance record.

## Tests supplied but not executed here

The PGlite suite includes the earlier authorization/retry/reward cases and new cases for live-session RLS, session/key revocation, database-backed web idle limits, frozen payment quotes, atomic staff notices, transfer authorization, and 1,005-card pagination. New Dart tests exercise payload encryption/decryption, tampering and associated-data binding. These tests require installed project dependencies and runtimes.

The environment lacks Flutter/Dart, Deno, PostgreSQL, Supabase CLI and Docker. The web dependencies and PGlite are not installed; package fetching failed in this environment. Actual attempts to run the web build and database tests failed on missing executables/modules, and the full verification script stops on missing tools. Consequently no full Next.js build, Deno application type-check, Flutter analysis/build, PostgreSQL migration/RLS/concurrency execution, authenticated browser run, native-device test, live provider test or store build is claimed.

## What still requires operator action or outside evidence

### Historical records cannot be invented

An old unsigned queue entry has no trustworthy account/device evidence to reconstruct. The upgrade preserves it rather than automatically crediting it. An older campaign promise or subscription interval that was never recorded also cannot be recovered from current state alone. Use documented records, reviewed reconciliation and the audited entitlement/support-quote paths; do not manufacture signatures or silently erase work.

### Deployment and credentials are not inside a source archive

Configure hosted phone confirmation, actual provider accounts/templates, the production approval environment, signing keys, Firebase/APNs, prices, approved company/policy/contact information and backup/restore procedures. The sample files contain placeholders, not production credentials. No live service or account was accessed or changed by this work.

### Trust and delivery have limits

Linked-session revocation does not prove that every historical unlinked session is associated with a particular physical phone. A compromise may require revoking all account sessions through Auth support controls. A freshly authenticated person can intentionally enroll another device. There is no hardware attestation or proof of purchase, so a rooted client or colluding authorized staff remains a fraud concern. Monotonic checks detect ordinary live clock changes but do not make an untrusted device clock authoritative.

FCM/WhatsApp acceptance is not proof of display or reading. Durable retries are at-least-once; OS presentation is not universally exactly-once. Staff and approval notices use the transactional outbox, while new-device security pushes remain best-effort. Four workers and a larger drain loop are not a load-test result; validate provider quotas, backlog age and platform execution limits. GitHub scheduling is an intended cadence, not a real-time guarantee.

### Final acceptance remains mandatory

Run the supplied full suites, all eleven migrations on a disposable restored database, separate-session race tests and native/browser acceptance. Verify camera/biometric permissions, background relocking, account switches, missing secure-storage keys, screen readers, large text and Arabic/Sorani copy. New web support/operations screens and some server-error fallbacks still use English. Commit the generated platform baseline and the CI-tested Flutter lockfile into the maintained repository after a successful run; this export does not fabricate an unresolved lockfile or mobile binary.

## Release decision

This bundle is the final edited source deliverable for this review. **Use staging first; do not represent the unrun runtime checks as passed or deploy blindly over legacy queues.** Begin with `START_HERE.md`, then follow `docs/UPGRADE.md` and `docs/final/OPERATIONS.md`.

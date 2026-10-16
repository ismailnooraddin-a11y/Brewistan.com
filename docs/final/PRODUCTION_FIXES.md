# Production-readiness fixes (applied on top of 1.0.1)

These were found by actually running the database tests, web build, Edge Function checks and the repo's own checks.

| Area | Problem | Fix |
| --- | --- | --- |
| Database | Migration 07 failed to apply: PL/pgSQL cannot parse `IF x = CASE WHEN ... THEN ... END THEN`. | Wrapped the `CASE` in parentheses (`20261016000007_billing_history.sql`). Migration 07 had never been applied anywhere. |
| Web | `next build` failed: `lib/session-policy.ts` type error under TypeScript 5.9. | `decode()` now returns `Uint8Array<ArrayBuffer>`. |
| Functions | CI helper type-check failed on `_shared/crypto.ts` (TypeScript 5.9 `BufferSource`). | Inputs copied to plain `Uint8Array` before WebCrypto calls. |
| Functions | Only `SUPABASE_SERVICE_ROLE_KEY` was read; Supabase retires legacy keys by end of 2026 and new projects use `sb_secret_...`. | `_shared/supabase.ts` falls back to `SUPABASE_SECRET_KEYS`. |
| Mobile | `PRAGMA secure_delete` was run with `execute()`, which can throw on Android because the pragma returns a row. | Uses `rawQuery()`. |
| CI | The scheduled job ran 4 workers every 5 minutes: far above GitHub's free private-repo minutes, which would block CI and deploys. | Job is opt-in (`ENABLE_GITHUB_SCHEDULE=true`). The go-live guide uses a free external scheduler. |

## Card designs now live in one file per app

| App | File |
| --- | --- |
| Mobile | `apps/mobile/lib/cards/card_designs.dart` |
| Web dashboard | `apps/web/lib/card-designs.ts` |
| Database | `20261016000012_card_design_ids.sql` only checks that a design id is well formed. |

Adding or removing a design means editing those two files (same id in both). No migration is needed.
A cafe whose chosen design was removed falls back to `noir`.

## Not verified here
Flutter could not be run in the review environment. Only syntax, imports, translation parity and cross-references were
checked for the Dart code. The CI `Flutter app` job is the first real analysis: run it and read the result before releasing.

# Final verification record

**Date:** 16 October 2026. **Result:** the explicitly listed local checks passed; full-stack validation remains unexecuted/blocked as detailed below.

## Executed successfully

| Check | Result | Evidence |
| --- | --- | --- |
| Node helper/protocol/source suite | 46 passed, 0 failed | `logs/node-final.log` |
| Python SQLite/platform fixtures | 11 passed | `logs/platform-final.log` |
| Strict dependency-free TypeScript | 8 modules passed, TypeScript 5.8.3 | `logs/strict-helpers-final.log` |
| TypeScript/TSX syntax | 83 files parsed | `logs/node-final.log` |
| Workflow syntax and embedded shell | 4 YAML files and 28 shell blocks | `logs/source-final.log` |
| JavaScript/JSON/source references | 9 JS modules; JSON and locale checks passed | `logs/source-final.log` |
| Mobile UI translation-key parity | 82 matching keys for en/ar/ckb; literal key references resolve | `logs/source-final.log` |

Runtime used: Node 22.16.0, npm 10.9.2, Python 3.13.5 and globally available TypeScript 5.8.3. The project-pinned dependency-backed compiler/build is a separate check, not a result inferred from the global compiler.

## Exact repeatable commands

After installing web dependencies, the scripts resolve TypeScript from `apps/web`. The local environment used `TYPESCRIPT_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript` because that was the available installation; do not copy that path blindly to another machine.

```bash
node --test scripts/audit-checks.mjs scripts/final-checks.mjs
python3 scripts/audit-platform-checks.py
node scripts/typecheck-helpers.mjs
python3 scripts/verify-source.py   # requires PyYAML
python3 scripts/verify-manifest.py
```

The strict helper command supplies only a small `Deno.env` type declaration. It checks HTTP/crypto/validation/worker/device-proof and the three dependency-free web helpers. It does not stub the application into a fake successful Next.js or Deno build.

The 19 added Node cases cover empty/bounded/repeated queue draining, deadline headroom, bounded parallelism, individual failures and claim failures; pagination input/encoding; exact registration serialization and time window; Ed25519 binding of every registration field; matching ten-minute scheduling lead time; relative imports/RPC references; and three expressly labeled source invariants. The earlier 27 checks cover cryptographic vectors, QR/voucher boundaries, request/CORS/JSON checks, numeral/date/session behavior and source/lockfile consistency.

## Added dependency-backed tests - not executed

`supabase/tests/final-regression.mjs` covers session-backed RLS/device revocation, server-side web idle policy, frozen quote amounts and repeat approval, transactional staff notices and lease tokens, recipient/admin transfer controls and a 1,005-card wallet fixture. `apps/mobile/test/payload_cipher_test.dart` covers encryption, tampering and associated-data isolation. These are supplied tests, not passed tests in this environment.

## Blocked or unavailable checks

`logs/unavailable-checks.log` records actual environment checks and failed attempts. `npm test --prefix supabase/tests` fails because `@electric-sql/pglite` is not installed. `npm run build --prefix apps/web` fails because `next` is not installed. The full script stops because Deno is absent. Flutter/Dart, Deno, Supabase CLI, PostgreSQL and Docker are absent. Dependency installation attempts could not resolve/fetch the needed packages.

Therefore these are **not verified**: dependency-backed Next.js build/type-check; Deno application type-check and tests; Flutter analysis/tests/build; Gradle/Xcode signing and native behavior; actual PostgreSQL migration/RLS/concurrency; live hosted Auth/Storage; WhatsApp/FCM/APNs; deployment and restore; authenticated visual/accessibility acceptance. Source parsing is not compilation, SQLite fixtures are not sqflite execution, and successful helper tests are not production certification.

## Packaging evidence

`BUNDLE_INFO.json` records input hashes, file/change counts and the unchanged first-five migration hashes. `MANIFEST.sha256` lists the exported files. The bundle verifier checks those hashes; it is not a digital signature. The included patch is checked against the reviewed input for the paths it covers. Old first-pass reports/logs under `docs/audit/` are historical, and intermediate `*-first*`/`*-baseline*` logs are not the final validation record.

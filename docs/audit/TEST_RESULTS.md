# Test results and verification boundaries

**Run date:** 16 October 2026. **Outcome:** all checks listed as executed below passed. Full-stack release validation is still outstanding.

## Executed checks

| Check | Result | Meaning and limit |
| --- | --- | --- |
| Node audit suite | **27 passed; 0 failed** | Executes actual transpiled dependency-free TypeScript helpers; also checks source parsing, imports and manifest/lock agreement. Not a Next.js build or a Deno execution. |
| Python SQLite/platform suite | **11 passed; 0 failed** | Executes extracted SQLite statements and isolated file/signing fixtures. Not Dart/sqflite lifecycle execution, a native build or PostgreSQL migration execution. |
| Strict isolated TypeScript | **5 modules passed** | Uses available TypeScript 5.8.3, browser libraries and a temporary declaration of Deno.env. Does not resolve the full app's third-party dependencies. |
| TypeScript/TSX parsing | **73 source files passed** | Parser diagnostics only; included in the 27 Node checks, not an additional 73 unit tests. |
| Workflow/shell parsing | **4 YAML files, 22 embedded run blocks passed** | YAML structure and Bash syntax only, not execution on GitHub Actions. |
| JavaScript module syntax | **6 modules passed** | `node --check`; no runtime dependency or provider integration claim. |
| Preservation checks | **Passed** | Original two migrations and uploaded archive unchanged; all transitive web lockfile entries and integrity values retained. |

### Exact local commands

From the repository root in the audit container:

```bash
TYPESCRIPT_PATH=/usr/local/slides_js/node_modules/typescript \
  node --test scripts/audit-checks.mjs
python3 scripts/audit-platform-checks.py

node /usr/local/slides_js/node_modules/typescript/bin/tsc \
  --noEmit --strict --skipLibCheck --moduleResolution bundler \
  --module esnext --target es2022 --lib dom,es2023 \
  --allowImportingTsExtensions /mnt/data/audit-evidence/deno-env.d.ts \
  supabase/functions/_shared/http.ts \
  supabase/functions/_shared/crypto.ts \
  supabase/functions/_shared/validation.ts \
  apps/web/lib/validation.ts apps/web/lib/session-policy.ts
```

Those absolute compiler/declaration paths describe the audit environment, not a required installation location. After `npm ci` in `apps/web`, run `node --test scripts/audit-checks.mjs` normally: it resolves that project's TypeScript dependency. The temporary ambient declaration is retained as `logs/deno-env-declaration.txt`. Production CI must run the project's actual dependency/toolchain versions.

The additional integrity pass used PyYAML for the four workflow files, ran each embedded `run` block through `bash -n` with GitHub expressions replaced by harmless fixture strings, ran `bash -n scripts/setup-mobile.sh`, and `node --check` on project `.mjs` files. It compared original migrations and the web lock's non-root package entries against the preserved original Git snapshot and checked the original upload hash.

### Node cases

- all TypeScript/TSX sources parse, without claiming semantic compilation
- relative TS imports resolve to existing project files
- Ed25519 seed derives the RFC 8032 known public key
- Ed25519 verifies RFC 8032 empty-message signature and rejects tampering
- signed platform tokens round-trip and reject malformed/tampered/oversized input
- base64url binary round-trip; malformed input rejected
- valid customer QR verifies with no voucher
- adjacent QR windows accepted, old and future windows rejected
- certificate expiry is exclusive at the exact second
- QR signature and format reject tampering and over-limit data
- voucher accepted only for matching customer, correct tag, and future expiry
- OTP digit generation validates lengths and produces fixed-length digits
- SHA-256 known vector
- CORS allows both dashboards and native clients; rejects other origins
- HTTP wrapper supports POST/preflight and never mutates on GET
- JSON accepts objects, rejects invalid, null, arrays and wrong media types
- body limits enforced with and without Content-Length
- UUID validation normalizes valid IDs and rejects ambiguous values
- Arabic and Persian digits normalize in web and server
- Baghdad schedule converts 09:00 and 20:59; rejects rollover dates/window/past
- contrast ratio handles canonical black/white and invalid hex
- signed session envelope can be refreshed within bounds
- cookie removal, tampering, and cross-account replay cannot restart an older session
- absolute and idle expiry are exclusive; future timestamps and weak secrets rejected
- verified auth context uses primary AMR, not refresh/MFA/iat
- manifest pins match lockfile resolved artifacts
- legacy queue requests fail as a whole so old clients cannot delete individual scans

### SQLite and platform fixture coverage

The Python suite checks schema creation and upgrade, legacy-queue preservation, account-filtered queue selection, the initial in-flight request delay, transaction rollback, offline device/day counting, retained result fields without the customer QR, non-destructive platform scaffolding, Groovy/Kotlin Gradle edits, signing failure without credentials, and selected shell/workflow safeguards. See the named test cases and outputs in `logs/platform-tests.log`.

Its SQL migration check is a basic delimiter/source sanity check, **not** PostgreSQL parsing or execution. SQLite tests do not establish that the Dart asynchronous code handles every device lifecycle and concurrency case.

## Added but NOT executed here

`supabase/tests/audit-regression.mjs` was added to the existing database harness. It exercises verified-phone membership activation, null-auth privilege boundaries, branch isolation, campaign pinning, replay context, entitlement, device registration, offline limits, reward timing, OTP attempt limits and notification acknowledgement state. Neither the original nor revised dependency-backed database suite could run because PGlite was unavailable and registry resolution failed.

Flutter tests were expanded for numeral normalization and campaign-specific reward labels. They were not executed because neither Flutter nor Dart was installed. The Edge tests were updated, but actual Deno checking and execution were unavailable. The Node WebCrypto tests are useful compatibility evidence; they do not certify the deployed Edge runtime.

## Not verified / release blockers

No successful full Next.js build, whole-application TypeScript check, Flutter analysis/test/build, native signing build, Deno execution, PostgreSQL/RLS/concurrency run, or hosted migration run is claimed. The environment lacked installed web project dependencies, Flutter/Dart, Deno, Supabase CLI/Docker, a PostgreSQL server and PGlite. The captured dependency-install failure is in `logs/baseline-db.log`.

No production environment, linked provider account, live customer data, real scanner/phone, WhatsApp/FCM delivery, storage upload or application-store release was exercised. No authenticated app browser or native-device visual audit was performed. The container's installed Tailwind 4.1.10 was not substituted for the project's Tailwind 3.4.19. Source-level layout improvements still need narrow-screen, keyboard, screen-reader, RTL and large-text testing on the actual applications.

Follow `docs/UPGRADE.md` and run the complete CI/staging matrix. Keep the distinction between a passing isolated check and a successful end-to-end business transaction.

## Evidence files

`logs/runtime-tests.log`, `logs/platform-tests.log`, `logs/typescript-isolated.log`, `logs/workflow-integrity.log`, `logs/environment.txt`, and `logs/baseline-db.log` are retained with this report. The baseline log records a failed dependency fetch, not a failed test assertion. The included source changes and database regressions are candidates for validation, not hidden claims that unrun suites passed.

## New: the integrated Brewistan website

For this website release, start with [WEBSITE_SETUP.md](WEBSITE_SETUP.md).
Do not import a separate standalone website or delete the old Vercel project yet.
The website lives in the existing `apps/web` project with host-based routing.

**2026-10-23 source update:** Read [UPDATE_2026-10-23.md](UPDATE_2026-10-23.md) first. The older release notes below describe the original source history and do not certify these new changes.

**Complete reference for the whole project (domains, hosting, settings, secrets, workflows): `PROJECT_REFERENCE.md`.**

# Start here - Brewistan final source bundle

**Version:** Source update on 23 October 2026, based on 1.0.1.

**Read `docs/final/PRODUCTION_FIXES.md` first: it lists the fixes made after this bundle was assembled.**

The complete revised project is in this folder: Flutter app, owner/admin web app, Supabase backend, all nineteen ordered migrations, assets supplied with the original project, configuration templates, setup/release scripts, tests, reports and evidence. Nothing needs to be copied from the earlier ZIP to use this source bundle.

## Read in this order

1. `AUDIT_REPORT.md` - final fixes, actual test results and remaining external requirements.
2. `docs/UPGRADE.md` - new-install/upgrade sequence, legacy queues and migration safety.
3. `README.md` - provider account and local-development setup.
4. `docs/final/OPERATIONS.md` - device recovery, historical entitlement, billing exceptions, ownership transfer and operations.
5. `docs/final/TEST_RESULTS.md` - executed versus unexecuted checks.

## Verify and build

```bash
python3 scripts/verify-manifest.py
# Install and configure the required runtimes and dependencies first:
bash scripts/verify-all.sh
```

The first command verifies the delivered file hashes, not correctness or an external digital signature. The second fails closed when required tools are missing. Full application/database tests and real-device/provider staging acceptance are still required; the local review passed 46 Node checks, 11 Python fixtures and eight standalone strict type-checks.

Use `apps/web/.env.example`, `config/backend.env.example` and `config/mobile-defines.example.json`. Keep filled configurations outside version control. Never put service credentials in web/mobile public build settings.

## Important boundaries

This is a source ZIP, not an APK, IPA, preinstalled dependency cache or deployed service. It deliberately contains no real credentials, signing keystore or font binaries. Mobile platform files/lockfile must be resolved and validated with Flutter; release automation reuses the exact successful CI baseline. Do not erase old queued scans, rotate away a needed key without the recovery procedure, or rewrite migrations already applied in an existing installation.

`docs/audit/` is the historical first-pass audit. `docs/final/` and the root report supersede it. A code/configuration patch from the reviewed input is included for traceability; the full ZIP is the authoritative deliverable.

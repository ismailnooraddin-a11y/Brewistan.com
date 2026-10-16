# Brewistan

Digital loyalty platform for luxury cafes in Iraq: one Flutter app for customers and baristas, a web dashboard for cafe owners at `dashboard.brewistan.com`, an admin panel at `admin.brewistan.com`, and a Supabase backend.

> **Final revised source, version 1.0.1.** Start with [START_HERE.md](START_HERE.md), [the final audit](AUDIT_REPORT.md), [current test evidence](docs/final/TEST_RESULTS.md), and [the upgrade runbook](docs/UPGRADE.md). This complete bundle contains twelve ordered migrations. It is not a signed binary or production certification; full-stack tests and staging acceptance remain required.

## What is in the repo

```
apps/mobile/        Flutter app (customer wallet + barista scanner, English/Arabic/Sorani)
apps/web/           Next.js owner dashboard + admin panel (one deployment, two hostnames)
supabase/
  migrations/       Database schema, Row Level Security, stamp and reward logic
  functions/        Edge Functions (WhatsApp OTP hook, scanning, sync, push, admin)
  tests/            Database rule tests (run in CI against an in-memory Postgres)
scripts/            Key generator, safe platform setup, audit checks and signing helpers
.github/workflows/  CI, Supabase deploy, optional scheduled job, mobile release builds
docs/               Upgrade runbook, test evidence, audit HTML and WhatsApp templates
```

## How it works

- **Sign-in:** WhatsApp OTP on first sign-in per install (all roles). Mobile sessions persist in the Keychain/Keystore with rotating refresh tokens, but logout, revocation and expired authentication are handled explicitly. Owners re-enter a code on the web after 2 hours idle or 12 hours total. Admins also need an authenticator app (MFA).
- **Customer code:** each install creates an Ed25519 key. The server issues a 30-day device certificate. The QR is `BW1~cert~window~voucher~signature`, re-signed every 30 seconds on the phone, fully offline. Scanners verify it offline with the platform public key, so they never hold a secret that could forge codes. Android blocks screenshots of the app.
- **Stamps:** one scan = one stamp, 2-hour cooldown per cafe, max 2 unclaimed rewards, versioned reward rules. Stamps use durable client event UUIDs and server-side idempotency. Offline work stays pending until the server accepts it.
- **Redemption:** the scanner asks "Redeem Free Coffee?" before stamping. Offline redemption only works with a server-signed voucher already on the customer's phone, capped centrally at 2 accepted offline redemptions per scanner device per Baghdad day. Reconciliation can reject provisional work, and the scanner retains the reason.
- **Offline barista mode:** scans queue on the phone (up to 5,000) and sync automatically. The scanner works on a signed staff snapshot for 72 hours, then locks until it reconnects. Scans by a barista removed before sync may be rejected; their reconciliation result is retained.
- **Owner controls:** staff invites by WhatsApp, new-barista review window, campaign approval with a WhatsApp step-up code, 2 campaigns per week, 09:00–21:00 Baghdad time, one message per customer per cafe per day.
- **Privacy:** owner customer-activity views use display names and per-cafe references rather than raw customer IDs/phones. Staff invitation and account-management data have separate access requirements.

## Go-live checklist

For a new installation, use these account-setup steps alongside the staging gates in `docs/UPGRADE.md`. Existing installations must follow the upgrade runbook before applying migrations.

### 1. Generate keys
```bash
node scripts/generate-keys.mjs
```
Keep the output private. `PLATFORM_PUBLIC_KEY` goes into the app; everything else is secret.

### 2. Supabase
1. Create a project at supabase.com (region closest to Iraq, for example Frankfurt).
2. Note the **project ref**, **database password**, **URL** and **anon key**; create a **personal access token** (Account > Access tokens).
3. Authentication > Providers > **Phone**: enable, and explicitly require phone confirmation on the hosted project. Authentication > Hooks > **Send SMS hook** (HTTPS): URL `https://<ref>.supabase.co/functions/v1/auth-send-otp`, then generate the secret and save it as `SEND_SMS_HOOK_SECRET`.
4. Authentication > Multi-factor: enable **TOTP**.
5. Authentication > URL configuration: Site URL `https://dashboard.brewistan.com`, add `https://admin.brewistan.com`.

### 3. Meta WhatsApp
1. Verify your business in Meta Business Manager and add a WhatsApp Business phone number.
2. Create the templates in `docs/WHATSAPP_TEMPLATES.md` and wait for approval.
3. Create a **System user** token with `whatsapp_business_messaging` permission (`WHATSAPP_TOKEN`) and note the **Phone number ID**.
4. Confirm in writing which authentication rate Meta will charge you for Iraqi numbers.

### 4. Firebase (push notifications)
1. Create a Firebase project, add an Android app `com.brewistan.brewistan` and an iOS app with your bundle ID.
2. Note API key, project ID, sender ID and both app IDs (used as GitHub variables).
3. Project settings > Service accounts > generate a key. Save the whole JSON as `FCM_SERVICE_ACCOUNT_JSON`.
4. iOS: upload your APNs key in Firebase > Cloud Messaging.

### 5. GitHub secrets and variables
Repository Settings > Secrets and variables > Actions.

| Secret | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token |
| `SUPABASE_PROJECT_REF` | Project ref |
| `SUPABASE_DB_PASSWORD` | Database password |
| `PLATFORM_SIGNING_SEED` | From step 1 |
| `CRON_SECRET`, `OTP_HASH_PEPPER` | From step 1 |
| `SEND_SMS_HOOK_SECRET` | From step 2.3 |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | From step 3 |
| `WA_TEMPLATE_LANGS` | e.g. `{"en":"en","ar":"ar","ckb":"ar"}` |
| `FCM_SERVICE_ACCOUNT_JSON` | From step 4.3 |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Your Play upload key (`base64 -w0 upload.jks`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Optional SMS fallback |

| Variable | Value |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | From step 2.2 |
| `PLATFORM_PUBLIC_KEY` | From step 1 |
| `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID`, `FIREBASE_ANDROID_APP_ID`, `FIREBASE_IOS_APP_ID` | From step 4.2 |
| `APP_DOWNLOAD_URL` | Your store link or landing page |
| `DASHBOARD_URL` | `https://dashboard.brewistan.com` |
| `ALLOWED_ORIGINS` | `https://dashboard.brewistan.com,https://admin.brewistan.com` |
| `OTP_DAILY_CAP` | Optional, default 2000 |

Configure GitHub's **production** environment approval and branch rules. A successful **CI** run for a push to `main` triggers **Deploy Supabase** for that exact commit; review and approve the environment gate only after staging validation. The deploy workflow applies migrations before functions. Verify the **Scheduled jobs** workflow and credentials before enabling production sends; its intended cadence is every five minutes. Coordinate mobile and web rollout as described in `docs/UPGRADE.md`.

### 6. Web dashboard on Vercel
1. Import the GitHub repo in Vercel. Set **Root Directory** to `apps/web`.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `WEB_SESSION_SECRET` (independent random secret, at least 32 characters), `ADMIN_HOST=admin.brewistan.com`, `NEXT_PUBLIC_ZAIN_CASH_NUMBER`, `NEXT_PUBLIC_FIB_ACCOUNT`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`.
3. Add both domains `dashboard.brewistan.com` and `admin.brewistan.com` to the same project and point DNS at Vercel.

### 7. Make yourself admin
Sign in once at `dashboard.brewistan.com` with your phone, then in Supabase > SQL editor:
```sql
insert into public.admins (user_id) select id from public.profiles where phone = '9647XXXXXXXXX';
```
Open `admin.brewistan.com`; you will be asked to set up an authenticator app.

### 8. Mobile apps
1. Run successful main-push CI, then **Actions > Mobile release build** on that exact commit. It reuses the tested Flutter version and lockfile to produce a signed Android App Bundle; upload it in Google Play Console (internal testing first).
2. iOS needs a Mac with Xcode (or a service like Codemagic): run `bash scripts/setup-mobile.sh`, open `apps/mobile/ios/Runner.xcworkspace`, set your team and bundle ID, enable Push Notifications, then archive and upload with the same `--dart-define` values as the workflow.
3. Store listings need the privacy policy URL: `https://dashboard.brewistan.com/privacy`.

Tip: after the first `scripts/setup-mobile.sh` run, commit the generated `android/` and `ios/` folders so app icons, signing and bundle settings live in the repo.

## Changing the stamp-card designs

Every card look is defined in two files: `apps/mobile/lib/cards/card_designs.dart` and `apps/web/lib/card-designs.ts`.
Add or remove a design in both (same id). No database change is needed. See the comments at the top of each file.

## Scheduled notifications

`push-dispatch` must be called every 5 minutes with the header `x-cron-secret`. The free option is an external scheduler
(see the go-live guide). The GitHub workflow `Scheduled jobs` is off by default; set the repository variable
`ENABLE_GITHUB_SCHEDULE=true` only on a public or paid repository.

## Before real customers

- Set real prices in the `pricing` table (placeholders: 50,000 / 100,000 / 250,000 IQD).
- Have native speakers review the Arabic and Sorani text (`apps/web/lib/i18n.ts`, `apps/mobile/lib/l10n/strings.dart`).
- Have Iraqi counsel review `/privacy` and `/terms`.
- Replace the default app icon and splash screen.
- Zain Cash and FIB are handled as manual transfers confirmed by an admin. Automatic payment APIs need merchant agreements and can be added later.

## Local development

```bash
# Database tests
(cd supabase/tests && npm ci && npm test)
# Edge functions type-check and tests (Deno 2)
deno check supabase/functions/*/index.ts
SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test deno test --allow-env supabase/functions/_tests/
# Web
(cd apps/web && cp .env.example .env.local && npm ci)
# Set WEB_SESSION_SECRET and the other .env.local values before starting.
node --test scripts/audit-checks.mjs scripts/final-checks.mjs
node scripts/typecheck-helpers.mjs
python3 scripts/audit-platform-checks.py
(cd apps/web && npm run dev)
# Mobile
bash scripts/setup-mobile.sh
(cd apps/mobile && flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=... --dart-define=PLATFORM_PUBLIC_KEY=...)
```

For testing without WhatsApp approval, set `APP_ENV=development` and the function secret `WHATSAPP_DEV_LOG=true` and read codes from the function logs. Never enable it in production.

## Known limits

- A customer's own app cannot show a barista's offline stamp until the scanner syncs.
- Offline scanning trusts the barista phone's clock within the 72-hour snapshot; caps and owner reports limit the impact.
- iOS cannot block screenshots; the 30-second rotation and cooldown limit reuse.

## Audit revision

The supplied archive contains 27 passing Node helper/source checks and 11 passing Python SQLite/platform fixture checks. Five standalone TypeScript helpers passed strict type-checking with a temporary Deno environment declaration. These checks do **not** establish a successful Next.js build, native Flutter build, Deno run, or execution of the new PostgreSQL migrations. See `docs/audit/TEST_RESULTS.md` for the exact evidence and remaining release blockers.

## Follow-up fixes included in this bundle

Read `docs/final/FINAL_FIXES.md` for session/key proof and revocation, encrypted pending payloads, historical entitlement, immutable payment quotes, list pagination, transactional staff/admin notices, bounded workers, operations metrics, ownership transfer, expiry-aware rendering and tested-CI mobile baseline reuse. Support procedures are in `docs/final/OPERATIONS.md`. Public privacy/terms pages are pre-launch drafts, not approved legal documents.

The generated native platform baseline and resolved Flutter lockfile must be tested and maintained after running Flutter/CI. They are not fabricated in this source export. No package binaries, real credentials or signed APK/IPA are included.

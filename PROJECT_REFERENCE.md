# Brewistan — complete project reference

Everything needed to run, change and rebuild Brewistan: code, hosting, domains, database,
automation, settings and external accounts. **No secret values are stored here** (this
repository is public). Each secret lists where it comes from.

Last updated: October 2026.

---

## 1. What Brewistan is

| Part | Who uses it | Address | Code |
|---|---|---|---|
| Customer app (PWA) + barista scanner | Customers, baristas | `https://app.brewistan.com` | `apps/web` (routes `/c/...`, `/cards`, `/scan`) |
| Café owner dashboard | Café owners | `https://dashboard.brewistan.com` | `apps/web` (`/dashboard`, `/onboarding`) |
| Admin panel | Brewistan team | `https://admin.brewistan.com` | `apps/web` (`/admin`) |
| Public website | Everyone (planned) | `https://brewistan.com` | not built yet |
| Backend: database, login, functions | all of the above | Supabase project `ybcdphsjyzjsjrarwiof` | `supabase/` |
| Native mobile app (later) | Customers, baristas | Google Play / App Store | `apps/mobile` (Flutter) |

The customer app, dashboard and admin panel are **one Next.js website** (`apps/web`) served on
three addresses. The server decides which part to show from the address.

---

## 2. Domains and DNS (Cloudflare)

Domain `brewistan.com` is managed in **Cloudflare**. All Vercel records must be **DNS only**
(grey cloud), never Proxied (orange).

| Type | Name | Target | Proxy | Purpose |
|---|---|---|---|---|
| CNAME | `dashboard` | value shown by Vercel (e.g. `xxxx.vercel-dns-017.com`) | DNS only | Owner dashboard |
| CNAME | `admin` | value shown by Vercel | DNS only | Admin panel |
| CNAME | `app` | value shown by Vercel for `app.brewistan.com` | DNS only | Customer app |
| A | `@` (brewistan.com) | `76.76.21.21` | DNS only | Public website (attach to the website's Vercel project when built) |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only | Public website |

**Important:** `brewistan.com` is currently attached to an **old Vercel project**, so it shows an
old page. Customer QR codes must use `app.brewistan.com`.

After adding a record, a computer may cache the old answer for a while. Fix: `ipconfig /flushdns`
(Windows) or test on mobile data.

---

## 3. Hosting — Vercel

### Project `brewistan-com-l2as` (the live website)
| Setting | Value |
|---|---|
| Git repository | `ismailnooraddin-a11y/Brewistan.com`, branch `main` |
| Root Directory | `apps/web` |
| Include files outside the root directory | **OFF** (ON breaks the build: "No Next.js version detected") |
| Framework | Next.js |
| Domains | `dashboard.brewistan.com`, `admin.brewistan.com`, `app.brewistan.com`, `brewistan-com-l2as.vercel.app` |
| Plan | Hobby now; **Pro required for commercial use** |

### Environment variables (Settings > Environment Variables)
| Name | Value / source | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ybcdphsjyzjsjrarwiof.supabase.co` | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API Keys > Publishable key (`sb_publishable_…`) | no (public by design) |
| `WEB_SESSION_SECRET` | 64 random hex characters you generated | **yes** |
| `ADMIN_HOST` | `admin.brewistan.com` | no |
| `NEXT_PUBLIC_ZAIN_CASH_NUMBER` | your Zain Cash number | no |
| `NEXT_PUBLIC_FIB_ACCOUNT` | your FIB account | no |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | support number, digits only, e.g. `9647…` | no |
| `NEXT_PUBLIC_CUSTOMER_URL` | optional; default `https://app.brewistan.com` | no |
| `CUSTOMER_HOSTS` | optional; default `app.brewistan.com` | no |

Changing any `NEXT_PUBLIC_…` value requires **Deployments > ⋯ > Redeploy**.

### Other Vercel projects
`brewistan-com`, `brewistan`, `brewistan-ikma`, `c-vistan`, etc. are older or unrelated projects.
`brewistan-com` is connected to the same repository and fails on every push: **Settings > Git >
Disconnect** it (safe; deletes nothing).

---

## 4. Backend — Supabase

| Setting | Value |
|---|---|
| Project ref | `ybcdphsjyzjsjrarwiof` |
| URL | `https://ybcdphsjyzjsjrarwiof.supabase.co` |
| Region | `ap-southeast-2` (Sydney). Works; a nearer region would need a new project |
| Plan | Free now; **Pro recommended** before real customers (backups, no pausing) |

### Authentication settings
| Where | Setting |
|---|---|
| Sign In / Providers > Phone | Enable Phone provider **ON**, Enable phone confirmations **ON**, OTP 6 digits |
| Sign In / Providers > Phone > Test Phone Numbers | `number=code` pairs, comma separated, e.g. `9647500000001=111111`. No message is sent. Remove when WhatsApp works (keep one for app-store reviewers) |
| Auth Hooks > Send SMS hook | HTTPS, URL `https://ybcdphsjyzjsjrarwiof.supabase.co/functions/v1/auth-send-otp`, secret `v1,whsec_…` (must equal GitHub secret `SEND_SMS_HOOK_SECRET`) |
| Multi-Factor | TOTP (App Authenticator) **Enabled** (required for admins) |
| URL Configuration | Site URL `https://dashboard.brewistan.com`; Redirect URLs include `https://admin.brewistan.com` and `https://app.brewistan.com` |

The Phone page shows Twilio fields: ignore them. "SMS provider settings are disabled while the SMS
hook is enabled" is correct.

### Edge Functions (deployed automatically)
`account-delete`, `admin-review`, `auth-send-otp`, `device-register`, `push-approve`,
`push-dispatch`, `scan`, `staff-manage`, `staff-snapshot`, `sync-upload`, `wallet`.

### Database migrations (`supabase/migrations`, applied in order, never edit applied ones)
| # | Purpose |
|---|---|
| 01–11 | Core schema, security, billing, notifications, devices, sessions, pagination, ownership |
| 12 | Card design ids checked by format (new designs need no migration) |
| 13 | Signature cafés may set colours; stamp style field |
| 14 | Campaigns per plan per month (Classic 0, Signature 1, Bespoke 5); barista risk report |
| 15 | Web devices (`platform = 'web'`) |
| 16 | Customer web app: profile gender/email, café and branch slugs (permanent), public QR page, join café without a stamp, registration, scanner café list |
| 17 | Branch reporting: stamps and redemptions per branch, recent stamps with branch |

### Useful SQL (Supabase > SQL Editor)
```sql
-- make someone platform admin (phone digits only)
insert into public.admins (user_id) select id from public.profiles where phone = '9647XXXXXXXXX';
-- approve a cafe manually
update public.cafes set status = 'active', approved_at = now() where id = '<cafe id>';
-- change a cafe's plan: classic | signature | bespoke
update public.cafes set tier = 'signature' where id = '<cafe id>';
-- set prices (IQD per month)
update public.pricing set monthly_iqd = 50000 where tier = 'classic';
```

---

## 5. GitHub

Repository: `https://github.com/ismailnooraddin-a11y/Brewistan.com` (public).
Edit code from **Code > Codespaces** (browser editor and terminal).

### Workflows (`.github/workflows`)
| File | Runs | Does |
|---|---|---|
| `ci.yml` | every push | Database tests, Edge Function checks, website build, Flutter checks |
| `deploy-supabase.yml` | after CI succeeds on `main` | Applies migrations, sets function secrets, deploys functions. "rate limit exceeded" = GitHub hiccup: **Re-run failed jobs** |
| `scheduled-jobs.yml` | only if variable `ENABLE_GITHUB_SCHEDULE=true` | Calls `push-dispatch`. Off by default (uses an external scheduler instead) |
| `mobile-release.yml` | manual | Builds the signed Android app (`.aab`); iOS job fails until Apple is set up |
| `web-app.yml` | manual | Optional Flutter web build (not used in production) |

### Secrets (Settings > Secrets and variables > Actions > **Secrets**)
| Name | Where the value comes from |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase > Account > Access Tokens (`sbp_…`, full access) |
| `SUPABASE_PROJECT_REF` | the 20 letters `ybcdphsjyzjsjrarwiof` (no spaces) |
| `SUPABASE_DB_PASSWORD` | set when the Supabase project was created |
| `PLATFORM_SIGNING_SEED` | `node scripts/generate-keys.mjs`. **Never change** (would invalidate all customer codes) |
| `CRON_SECRET` | `node scripts/generate-keys.mjs` (also used by the scheduler) |
| `OTP_HASH_PEPPER` | `node scripts/generate-keys.mjs` |
| `SEND_SMS_HOOK_SECRET` | Supabase Auth Hooks > Send SMS > secret (`v1,whsec_…`, full line) |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload.jks` |
| `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_PASSWORD` | passwords chosen when creating `upload.jks` |
| `ANDROID_KEY_ALIAS` | `upload` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WA_TEMPLATE_LANGS` | Meta WhatsApp (not set yet) |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase service account (not set yet) |

### Variables (same page, **Variables** tab)
| Name | Value |
|---|---|
| `DASHBOARD_URL` | `https://dashboard.brewistan.com` |
| `ALLOWED_ORIGINS` | `https://dashboard.brewistan.com,https://admin.brewistan.com,https://app.brewistan.com` |
| `APP_DOWNLOAD_URL` | `https://app.brewistan.com` |
| `SUPABASE_URL` | `https://ybcdphsjyzjsjrarwiof.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable key |
| `PLATFORM_PUBLIC_KEY` | from `node scripts/generate-keys.mjs` |
| `FIREBASE_*` | not set yet |

**Android signing key `upload.jks`:** keep the file and passwords backed up in two places.
Losing them means you can never update the Android app.

---

## 6. Scheduled notifications (cron-job.org)
| Setting | Value |
|---|---|
| URL | `https://ybcdphsjyzjsjrarwiof.supabase.co/functions/v1/push-dispatch` |
| Schedule | every 5 minutes |
| Method | POST, body `{}` |
| Headers | `x-cron-secret: <CRON_SECRET>`, `Content-Type: application/json` |

Status: set up only when push notifications are configured (Firebase).

---

## 7. External accounts and status
| Service | Status | Next step |
|---|---|---|
| Meta Business "Brewistan" | Created, details filled, WhatsApp account started | Buy a new SIM never used on WhatsApp, add it as the WhatsApp number, create the 5 templates (`docs/WHATSAPP_TEMPLATES.md`), add GitHub secrets |
| Google Play Console | Developer account created (Individual) | Identity verification, app listing, upload `.aab` (needs an Android phone to test) |
| Apple Developer | Not started (PWA chosen for year 1) | Only when moving to native apps |
| Firebase (push) | Not started | Create project, web app + VAPID key, Android app, service account |
| cron-job.org | Not started | After Firebase |

---

## 8. Product rules (how it behaves)
- **One customer account** for all cafés (phone number + code, no password). First time: first
  name, last name, gender, optional email.
- **One card per café**, shared by all its branches. Different cafés never share stamps.
- **Branch QR** (`app.brewistan.com/c/<cafe>/<branch>`) only opens the card. **Stamps are added only
  when a barista scans the customer's code** at `app.brewistan.com/scan`.
- The customer code changes every 30 seconds and is signed by the customer's phone.
- Owners see which branch every stamp came from (Scan history > By branch, Recent stamps).
- Plans: **Classic** (card name only, metallic status colours, no campaigns), **Signature**
  (logo, own colours, 1 campaign/month), **Bespoke** (designed by Brewistan, 5 campaigns/month).
- A customer gets at most one campaign message per café per day.
- Card designs: `apps/mobile/lib/cards/card_designs.dart` + `apps/web/lib/card-designs.ts`.

---

## 9. Making a change (normal routine)
1. Open the Codespace, change files (or unzip an update into the repository folder).
2. In the terminal:
   ```
   git add -A && git commit -m "describe the change" && git push origin main
   ```
3. Watch **Actions**: CI, then Deploy Supabase (if the database or functions changed).
4. Vercel publishes the website automatically (about 2 minutes).
5. Hard refresh the browser: Ctrl + Shift + R.

---

## 10. End-to-end test
1. Supabase test numbers: add e.g. `9647500000001=111111` (customer) and `9647500000002=222222` (barista).
2. Dashboard > Staff: invite `9647500000002`.
3. Dashboard > Branches: download a branch QR and scan it with your phone, or open the link.
4. Sign in with `0750 000 0001` / `111111`, fill in the profile; the card opens with 0 stamps.
5. On a laptop open `app.brewistan.com/scan`, sign in with `0750 000 0002` / `222222`, choose the branch, start the camera, scan the phone's code, tap **Add stamp**.
6. Within about 10 seconds the phone shows 1 stamp; Dashboard > Scan history shows it under the branch.

The owner's own number cannot collect stamps at their own café (by design).

---

## 11. Known issues and fixes
| Symptom | Fix |
|---|---|
| QR opens an old "Page not found" on brewistan.com | Use `app.brewistan.com` codes (Dashboard > Branches); disconnect the old Vercel project |
| Vercel build: "No Next.js version detected" | Root Directory `apps/web`, "Include files outside the root directory" OFF, Redeploy |
| Deploy Supabase: "Cannot resolve project ref" | Re-type `SUPABASE_PROJECT_REF` (20 letters, no spaces) |
| Deploy Supabase: "Invalid hook config … v1,whsec_" | `SEND_SMS_HOOK_SECRET` must be the full `v1,whsec_…` line |
| "Unsupported phone provider" on sign-in | Enable the Phone provider and the Send SMS hook |
| "Service currently unavailable due to hook" | Number not in Test Phone Numbers and WhatsApp not configured yet |
| Site "can't be reached" after adding DNS | Local DNS cache: flush or test on mobile data |
| Admin QR "Error generating QR Code" | Open issue (Supabase TOTP enrolment). Approve cafés with SQL meanwhile |
| Web notifications missing on iPhone | Customer must add the app to the Home Screen first |

---

## 12. Not built yet (roadmap)
- Apple Wallet and Google Wallet passes (need Apple/Google issuer accounts).
- Push notifications (need Firebase).
- Branch manager role (limited owner access per branch).
- Public marketing website on `brewistan.com`.
- Native apps (Flutter code in `apps/mobile` is ready; release after the 6-month PWA review).

## 13. Where to read more
`README.md`, `docs/final/CUSTOMER_WEB_APP.md`, `docs/final/OPERATIONS.md`,
`docs/WHATSAPP_TEMPLATES.md`, `docs/final/PRODUCTION_FIXES.md`.

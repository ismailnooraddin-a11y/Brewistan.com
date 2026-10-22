# Web app (PWA) — app.brewistan.com

The customer and staff app is published as an installable web app, built from the same
Flutter code as the Android/iOS apps (`apps/mobile`). Moving to the stores later needs no
data migration: same server, same accounts, same cards.

## How it is built and published
- Workflow: `.github/workflows/web-app.yml` (runs on every change under `apps/mobile/`).
- Hosting: GitHub Pages, custom domain `app.brewistan.com`.
- Local database in the browser: SQLite compiled to WebAssembly (`sqflite_common_ffi_web`).
- Devices register with platform `web` (migration `20261016000015_web_app_devices.sql`).

## Differences from the native apps
- iPhone push works only after the customer adds the app to the Home Screen and taps
  Settings > Turn on notifications. Android Chrome works directly.
- No fingerprint/PIN lock for staff mode in the browser; staff mode still locks when the app
  goes to the background.
- Screenshots of the QR code cannot be blocked (the code changes every 30 seconds).
- Opening the app needs internet; once open, scanning keeps working offline and syncs later.

## Push notifications (optional, after Firebase is set up)
Add GitHub variables `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID`,
`FIREBASE_WEB_APP_ID` and `FIREBASE_VAPID_KEY`, then re-run the workflow.

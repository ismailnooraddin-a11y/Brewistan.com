# Phase 1 — Hotfix & Deployable Build

**Status:** Verified — typecheck passes, `next build` completes successfully.

## Files changed (8)

| File | Change |
|---|---|
| `app/(marketing)/page.tsx` | Fixed `<<div` JSX syntax error; updated hero `src` to `/images/hero-phone.png`. |
| `public/images/hero-phone.png` | Renamed from `iPhone 17 (1).png` (spaces in URL break routing). |
| `.env.example` | **New file.** Documented placeholders for all required env vars. |
| `lib/utils/index.ts` | Added `safeRedirect()` helper — rejects `//evil.com`, protocol URLs, control chars, oversized paths. |
| `app/(auth)/get-started/page.tsx` | Uses `safeRedirect()`; reads `?tab=signin` query param to pre-select sign-in tab; syncs tab on URL change. |
| `app/auth/callback/route.ts` | Uses `safeRedirect()` on the `next` param. |
| `lib/supabase/middleware.ts` | Uses `safeRedirect()` on the `redirectTo` value embedded in 302 responses. |
| `app/c/[cafeSlug]/page.tsx` | "I have an account" link now points to `?tab=signin&redirectTo=...`. |
| `next.config.js` | Added Content-Security-Policy (Supabase REST + WebSocket scoped), HSTS, DNS prefetch control. Kept existing X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. |

## Issues resolved

- ✅ **CRIT-1** — `<<div` JSX typo (build was failing)
- ✅ **CRIT-2** — Missing `/images/loyalty-card.png` (broken hero image)
- ✅ **HIGH-4** — Open redirect on `redirectTo` and `next` params
- ✅ **MED-9** — "I have an account" tab not differentiated
- ✅ **HIGH-7** — Missing Content-Security-Policy header
- ✅ **MISC** — Missing `.env.example` referenced by README

## Verification performed

- `tsc --noEmit` — exit 0, zero errors
- `next build` — succeeded, all 7 route groups compiled
- Manual file inspection of all 8 changed files

## Deployment steps

1. Replace your repo contents with this zip.
2. `npm install` (no new dependencies in Phase 1).
3. `npm run build` locally to confirm.
4. `git add -A && git commit -m "Phase 1: hotfix and security headers" && git push origin main`.
5. Vercel auto-deploys (~2 min).
6. Smoke test on production:
   - Open `https://yourdomain.com` — landing page renders, hero image loads.
   - Try `https://yourdomain.com/get-started?redirectTo=https://evil.com` — confirms you're sent to `/dashboard` after sign-in, NOT to evil.com.
   - Open café scan page, click "I have an account" — confirm it lands on the sign-in tab.
   - Check `curl -I https://yourdomain.com` shows `Content-Security-Policy` header.

## What's NOT done yet (Phase 2+)

- QR code generation
- Logo upload UI
- Cross-device email confirmation handling
- Dedicated `/staff` route for baristas
- Reward redemption flow
- Soft-delete for campaigns

These are scoped for Phase 2. After Phase 1, the site builds, deploys, and is no longer an open-redirect risk — but the full product loop is still incomplete.

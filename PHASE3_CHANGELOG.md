# Phase 3 — Production Hardening

**Status:** Verified — typecheck passes (0 errors), `next build` completes successfully, all 9 dashboard subroutes compile (added `audit`, `redemptions` from P2).

## What Phase 3 delivers

The product is now polished, accessible, type-safe across all surfaces, and mobile-friendly on the marketing site. The barista rejection flow no longer uses a native browser prompt. Card text contrast now meets WCAG AA on all colors. Owners get an audit log viewer to see who did what, when. No new database migrations are required.

## SQL migrations to run

**None.** Phase 3 is purely frontend/code changes. The `audit_log` table already exists from `20260424000000_init.sql`, with RLS allowing owners to read their own café's events.

## Files changed (8)

| File | Change |
|---|---|
| `lib/utils/index.ts` | Replaced YIQ-based `readableContrast` with WCAG 2.x relative-luminance formula. Now passes AA contrast on mid-range greens, teals, and oranges that the old function failed on. |
| `lib/schemas/index.ts` | Added `cafeMiniSchema`, `campaignMiniSchema`, `customerCardSchema`, and a `safeParseRows` helper for runtime validation of fetched DB data — protects UI from schema drift without crashing on a single bad row. |
| `app/(marketing)/page.tsx` | Header replaced with the new `<MarketingNav />` client component. |
| `app/globals.css` | Added `.nav-burger`, `.nav-mobile`, `.nav-mobile-backdrop` classes; updated 960px media query to swap desktop nav for hamburger; added `.nav { position: relative }` for menu positioning. |
| `components/dashboard/StampRequestsLive.tsx` | Replaced `window.prompt()` rejection with inline form (text input, Enter to confirm, Escape to cancel); useMemo'd supabase client. |
| `components/customer/CustomerStampButton.tsx` | useMemo'd supabase client. |
| `components/dashboard/BranchesManager.tsx` · `StaffManager.tsx` · `SettingsForm.tsx` | useMemo'd supabase clients (consistent across all dashboard managers). |
| `components/dashboard/Sidebar.tsx` | Added Audit log link with History icon. |

## Files added (2)

| File | Purpose |
|---|---|
| `components/marketing/MarketingNav.tsx` | Client component with mobile hamburger menu, ESC-to-close, body scroll lock when open, accessible aria attributes. |
| `app/dashboard/audit/page.tsx` | Owner audit log viewer with action-type filter pills, color-coded action badges (good/bad/info/warn), shows last 200 events, includes actor name + summarized metadata. |

## Issues resolved

- ✅ **NICE** (3.1) — Inline rejection input replaces `window.prompt()`. Works in PWA mode, fits the design.
- ✅ **NICE** (3.2) — Marketing page has a working hamburger menu on mobile. No more overflowing nav links on phones.
- ✅ **NICE** (3.4) — `readableContrast` now uses WCAG luminance formula. Card text passes AA contrast on all preset colors.
- ✅ **NICE** (3.5) — Every component-side `createClient()` call is now memoized. Eliminates the subscription re-registration code smell.
- ✅ **NICE** (3.7) — Zod read-side schemas + `safeParseRows` available for queries that need defensive parsing.
- ✅ **NICE** (3.8) — Owners can see operational history at `/dashboard/audit` with filtering.
- ℹ️ Tasks 3.3 (remove `any` types in wallet) and 3.6 (zero-stamp guard) were already completed in Phase 2.

## Verification performed

- `tsc --noEmit` — exit 0, zero errors
- `next build` — succeeded; all 8 route groups compiled, including the new `audit/` subroute under `dashboard/`
- Manual file inspection of all changed/added files

## Deployment steps

1. Replace your repo contents with this zip (preserves Phase 1 + Phase 2 changes).
2. **No SQL migration needed.**
3. `npm install` (no new dependencies).
4. `npm run build` locally to confirm.
5. `git add -A && git commit -m "Phase 3: production hardening" && git push origin main`.
6. Vercel auto-deploys (~2 min).

## Phase 3 smoke-test checklist

1. **Mobile nav:** Open the landing page on a phone (or Chrome DevTools mobile mode at 375px width). Confirm hamburger button appears in the top-right. Tap it → menu slides down with all 4 nav items. Tap backdrop or Escape → menu closes.
2. **Inline rejection:** As barista, open `/staff/stamp-requests`. Tap the X reject button on a pending request → inline form expands with optional reason input. Type a reason, press Enter → request is rejected with the note. Try pressing Escape → form cancels.
3. **WCAG contrast:** In `/dashboard/brand`, click each preset color (Olive, Gold, Rose, Ink, Espresso, Sage). Confirm card text remains readable on all of them (the old function failed on Sage and Gold mid-tones).
4. **Audit log:** Approve a stamp, archive a campaign, redeem a reward. Open `/dashboard/audit` → confirm all 3 events appear. Click a filter pill → confirm the list filters correctly. Click "All" → returns to full list.
5. **No more browser prompts:** Confirm there are no remaining `window.prompt()` calls in the codebase. (`grep -r "window.prompt\|^.*= prompt(" app components lib` should return nothing.)

## What's NOT done yet (Phase 4)

- Privacy Policy + Terms pages
- Cookie consent banner
- next-intl + Arabic / Kurdish translations
- RTL layout switching
- Language switcher component

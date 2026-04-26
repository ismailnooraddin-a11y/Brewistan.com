# Phase 2 — Core Workflow Completion

**Status:** Verified — typecheck passes (0 errors), `next build` completes successfully (all 8 route groups compiled).

## What Phase 2 delivers

The product now works end-to-end. A café owner can sign up, upload a logo, customize their card, print a QR, run the full stamp loop with customers, and customers can redeem rewards at the counter with staff confirmation. Baristas have a dedicated mobile-first screen separate from the owner dashboard.

## SQL migration to run

Before deploying the code, run the new migration in your Supabase SQL Editor:

```
supabase/migrations/20260426000000_phase2.sql
```

This adds:
- `campaigns.deleted_at` (soft delete column)
- Loosens `loyalty_cards.campaign_id` foreign key from `ON DELETE CASCADE` to `ON DELETE SET NULL` — deleting a campaign no longer wipes customer history
- `staff_profile_active_idx` index for fast role lookup
- New helper RPCs: `get_my_active_redemptions`, `get_cafe_pending_redemptions`
- Updated `request_stamp` RPC to skip soft-deleted campaigns
- Updated RLS policy `campaigns_select_active_or_staff` to filter soft-deleted campaigns from customers
- Audit trigger `tr_campaign_soft_delete` for soft-delete events

## Files changed (10)

| File | Change |
|---|---|
| `lib/database.types.ts` | Added `RedemptionStatus`, `SubscriptionStatus`, `reward_redemptions` table, `cafes.subscription_status` and related columns, `campaigns.deleted_at`, nullable `loyalty_cards.campaign_id`, new RPC signatures (`redeem_reward`, `get_my_active_redemptions`, `get_cafe_pending_redemptions`). |
| `lib/queries/index.ts` | Filter soft-deleted campaigns everywhere; added `getCurrentUser`, `getStaffMembership`, `getCustomerActiveRedemptions`, `getCafePendingRedemptions`, `getCafeCampaigns`; expanded `getCafeStats` with `pendingRedemptions` count. |
| `lib/supabase/middleware.ts` | Protect `/staff` route with same auth gate as `/dashboard`/`/wallet`. |
| `components/customer/LoyaltyCard.tsx` | Accept `logoUrl`, `cardText`, `cardOpacity` props; render logo as background-image with initial fallback; defensive guards against zero/negative `stampsRequired`. |
| `components/dashboard/BrandEditor.tsx` | Wire LogoUploader; useMemo'd supabase client; pass `logoUrl`/`cardText`/`cardOpacity` to preview card. |
| `components/dashboard/CampaignsManager.tsx` | Soft-delete (sets `deleted_at` + status='archived') instead of hard-delete; added Restore action; "Show archived" toggle; useMemo'd supabase client. |
| `components/dashboard/Sidebar.tsx` | Added Redemptions link with Gift icon. |
| `app/wallet/page.tsx` | Refactored with proper types (no more `any`); active redemptions panel at top; passes logo/text/opacity to LoyaltyCard; filters out soft-deleted campaigns. |
| `app/(auth)/get-started/page.tsx` | Stash full café details in `auth.signUp` user_metadata so cross-device email confirmation can recover. |
| `app/dashboard/page.tsx` | Render PendingCafeFinisher when user has no café but metadata has pending_cafe. |
| `app/dashboard/layout.tsx` | Route `barista` and `branch_manager` roles to `/staff`; only `cafe_owner`/`admin` stay on `/dashboard`. |

## Files added (10)

| File | Purpose |
|---|---|
| `supabase/migrations/20260426000000_phase2.sql` | Phase 2 schema migration. |
| `components/customer/RedeemRewardButton.tsx` | Customer-facing reward redemption with realtime status + polling fallback; shows large monospaced redemption code for the barista to read. |
| `components/dashboard/LogoUploader.tsx` | Drag-drop file upload to Supabase Storage with RLS-safe `{cafe_id}/logo-*.ext` paths; replaces and removes existing logos. |
| `components/dashboard/PendingCafeFinisher.tsx` | Cross-device email confirmation recovery; pre-fills café form from `user_metadata.pending_cafe` and finishes setup via `create_cafe` RPC. |
| `components/staff/StaffRedemptionsLive.tsx` | Realtime queue of pending reward redemptions for barista to confirm; code filter input; calls `redeem_reward` RPC. |
| `app/staff/layout.tsx` | Mobile-first sticky header + tab nav; role-gated to barista/branch_manager/cafe_owner. |
| `app/staff/page.tsx` | Redirects to `/staff/stamp-requests`. |
| `app/staff/stamp-requests/page.tsx` | Wraps existing `StampRequestsLive` for staff member's café. |
| `app/staff/redemptions/page.tsx` | Server component for staff redemption queue. |
| `app/dashboard/redemptions/page.tsx` | Owner overview: active redemptions table + recent activity table + 4 KPIs. |

## Issues resolved

- ✅ **HIGH-5** — Baristas now have a dedicated `/staff` route (mobile-first), instead of seeing the owner dashboard or being bounced to the customer wallet.
- ✅ **HIGH-6** — Campaigns soft-delete via `deleted_at` + cascade rule changed; deleting a campaign no longer wipes customer loyalty history.
- ✅ **GAP-11** — Logo upload UI implemented end-to-end (component + storage + render).
- ✅ **GAP-12** — Reward redemption flow implemented end-to-end (customer button + staff confirmation + owner overview).
- ✅ **GAP-13** — `card_text` and `card_opacity` now passed through queries → BrandEditor preview → LoyaltyCard render.
- ✅ **CRIT-3** — Cross-device email confirmation no longer dead-ends; user_metadata persists café details, PendingCafeFinisher recovers them.
- ✅ **WARN-8** — Defensive zero-stamp guard in LoyaltyCard.
- ✅ Owner can see redemption history at `/dashboard/redemptions`.

## Verification performed

- `tsc --noEmit` — exit 0, zero errors (after fixing one inferred `any` in wallet redemptions map)
- `next build` — succeeded; all 8 route groups compiled: `(auth)`, `(marketing)`, `auth`, `c`, `dashboard`, `staff`, `wallet`, `_not-found`
- Manual file inspection of all changed/added files

## Deployment steps

1. Replace your repo contents with this zip (preserves Phase 1 changes).
2. In Supabase SQL Editor, run `supabase/migrations/20260426000000_phase2.sql` (one-time).
3. In Supabase Storage, confirm the `cafe-logos` bucket exists (created by the original `20260424000001_storage.sql` — already in place if you've been deployed).
4. `npm install` (no new dependencies — `qrcode` was already in package.json).
5. `npm run build` locally to confirm.
6. `git add -A && git commit -m "Phase 2: core workflow completion" && git push origin main`.
7. Vercel auto-deploys (~2 min).

## Phase 2 smoke-test checklist (run on production)

1. **Logo upload:** Sign in as café owner → `/dashboard/brand` → upload a logo → confirm preview updates → confirm logo appears on customer card view.
2. **Card customization:** Change text color and opacity sliders → confirm changes appear in preview AND on `/c/[slug]` after Save.
3. **QR code:** Click "Download PNG" on `/dashboard/brand` → confirm a real QR file downloads.
4. **Soft delete:** Create a test campaign → archive it → confirm the customer's loyalty card on that campaign still shows in their wallet (not wiped). Toggle "Show archived" → restore it.
5. **Cross-device signup:** Sign up with email confirmation enabled in Supabase → click confirm link from a different device or browser → confirm `/dashboard` shows the PendingCafeFinisher form pre-filled → click "Create my café" → confirm café is created.
6. **Reward redemption end-to-end:**
   - Customer reaches stamp threshold → barista approves stamp → reward is auto-issued.
   - Customer sees "Rewards waiting" banner on `/wallet` with their reward.
   - Customer taps reward → 6-character code appears on dark panel.
   - Staff opens `/staff/redemptions` on their phone → sees the code in queue → taps Confirm → customer's screen updates to "Redeemed".
7. **Role routing:** Sign in as a barista (someone with `staff` role + invitation accepted) → confirm they land on `/staff/stamp-requests`, NOT the owner dashboard.

## What's NOT done yet (Phase 3+)

- Polish: replace `window.prompt()` rejection input with inline UI
- Mobile hamburger menu on marketing landing page
- WCAG-compliant contrast function (currently uses non-standard YIQ threshold)
- Audit log viewer for owners
- Additional Zod validation layer on fetched data
- Privacy Policy + Terms pages (Phase 4)
- Arabic / Kurdish / RTL support (Phase 4)

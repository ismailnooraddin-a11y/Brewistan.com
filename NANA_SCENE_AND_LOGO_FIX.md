# Brewistan — Nana’s Tea scene experiment and logo preview fix

## Purpose

This package builds on the complete marketing-site release (2026-10-23). It adds an opt-in cinematic card-detail experiment for **Nana’s Tea only**. It also repairs the café-owner logo preview so a newly selected image becomes visible immediately and stays correct after publishing.

## How to test on iPhone

1. Install/existing PWA: open `https://app.brewistan.com` and sign in as a customer who has Nana’s Tea card.
2. Tap **Nana’s Tea** from **My cards**.
3. Because Nana’s Tea is presently on **Signature**, tap **Preview scene** in the small Nana-only design preview control.
4. The customer card should appear with the supplied tea-room photograph, subtler lighting and perspective. QR remains outside transformed card and remains unaltered.
5. Tap **Standard card** to leave the test. The list of cards remains unchanged, regardless of how many cafés the customer has.
6. After owner uploads a logo in Dashboard → Branding, the live preview should update immediately and show **Logo published** after the server accepts the change. A fresh customer wallet load pulls the newly versioned logo path.

## Plan behavior & safety

- Only the exact Nana’s Tea café ID `5b89b7ab-46a8-4328-99b1-bebc752b921d` is eligible.
- **Bespoke** automatically displays the scene for Nana’s Tea (if upgraded later).
- **Signature** requires explicit user opt-in via the Nana’s Tea design-preview button **for testing only**; it does not grant a subscription or change any backend entitlement. This temporary UI must be removed or admin-limited before marketing the Bespoke feature to other cafés.
- **Classic** never gets the scene.
- No scene imagery appears in the all-cards list, Apple Wallet, or Google Wallet.
- The QR code is not transformed, blended, animated, or cached as an image asset.
- No Supabase migrations, Edge Function changes, DNS edits, or Vercel secrets are required for this visual test.

## Deployment checklist

- Extract the ZIP in the repository root, preserving your existing `apps/web` root in Vercel.
- Run `python3 scripts/verify-manifest.py`, `node scripts/nana-scene-checks.mjs`, and `cd apps/web && npm ci && npm run typecheck && npm run build`.
- Commit to a new GitHub branch and open a PR for CI. Test its Preview deployment, then merge after checks pass.
- Avoid deleting PWA data or signing out just to test branding. The wallet should update on refresh/revisit.

## Notes

- Photo source: exact JPEG supplied by the user in this conversation. Converted to compact WebP in `apps/web/public/scenes/nanas-tea.webp`, rather than using a generated lookalike.
- Visual test only. Generalizing the feature to all Bespoke cafés needs a managed per-café scene asset and an owner upload/review flow, with tier authorization enforced server-side.
- If the upload preview changes but the customer remains on the old logo, check that the logo save returned success and that the customer wallet has refreshed. The new logo path is unique per upload to avoid storage cache collisions.

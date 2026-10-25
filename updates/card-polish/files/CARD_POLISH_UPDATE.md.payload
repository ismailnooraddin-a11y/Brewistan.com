# Brewistan card polish - 25 October 2026

## What changes
- The wallet and opened cafe use one vector/text card component. No progress-bar substitute, flattened screenshot or CSS scaling.
- Stamp circles, cafe branding, logo, colours and rewards use the same layout in both views. Twelve stamps use two balanced rows of six.
- The actual account full name appears without a "Customer name" label. The per-cafe last stamp is shown with a date including the year. No last-visit date is inferred. No activity shows "No stamps yet".
- Customer-facing background preview/banner/switch controls are removed from the rendered detail page.
- Black is the default card-page background. A saved scene appears only when the cafe's database-supplied tier is `bespoke`.
- Dashboard > Branding > Cafe atmosphere provides black, the supplied tea-room preset, or an owner-uploaded image. The multi-card wallet remains black.
- Background image errors fall back to black. QR data, signing, rotation and device/auth hooks are preserved.

## Apply to the CURRENT checkout
This is deliberately a targeted installer, not a copy of the older full-project ZIP. The current repository's source was not accessible for download; the installer uses TypeScript syntax-aware edits and refuses unfamiliar component structures rather than blindly overwriting your newer QR fixes.

```bash
unzip -o brewistan-card-polish-2026-10-25.zip
node scripts/apply-card-polish.mjs
node scripts/card-polish-checks.mjs
python3 scripts/verify-manifest.py
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
```

The installer requires your existing `apps/web/node_modules/typescript`. If it is absent, run `npm --prefix apps/web ci` first. It backs up changed source outside the repository, prints that path and updates only affected integrity-manifest entries. It does not contact a backend, edit secrets, alter a subscription, or deploy anything. Running it twice is safe.

After a successful build, Next.js may regenerate `apps/web/next-env.d.ts`. Inspect that diff before restoring only this generated file, then verify the manifest again. Commit on a new branch and review the Vercel preview before merging. GitHub's existing checks remain required.

## Choose the background
Use the EXISTING admin subscription workflow to put a cafe on Bespoke if appropriate. Then as its owner open Dashboard > Branding > Cafe atmosphere, select the tea-room image (or upload a photo) and Publish background.

A read-only check during preparation found Nana's Tea on Signature with no stored scene. This update does NOT upgrade it or bypass its plan. Its previous temporary preview does not count as a saved background. It will use black until its tier is Bespoke and a scene is published.

## Data and compatibility
No database migration or Edge Function deployment is required. Existing wallet RPC data includes `profile.firstName`, `profile.lastName` and each card's `lastStampAt`; snake_case cached values are also accepted. The label is intentionally "Last stamp", not "Last visit". Dates use the customer's browser time zone.

Scene settings use existing `cafes.brand` JSON: `scene` is `none`, `tea_room`, or `custom`; `scene_path` is a cafe-scoped Storage path for custom images. The existing server protects `cafes.tier` and owner/cafe updates. Client rendering and owner controls require that protected tier to be Bespoke. No new database constraint is placed on arbitrary branding JSON; images are public branding assets, not protected customer data.

Custom images use the existing owner-scoped `branding` bucket. They are re-encoded to remove metadata and kept below its existing 1 MB limit. No remote arbitrary URLs, SVGs or another cafe's file paths are accepted by the scene resolver. Publishing card colours preserves scene settings and other branding fields. No customer names are embedded into public image files.

The bundled scene is optimized WebP from the user-supplied photo. It is used only when explicitly selected. It can be cached by the existing service worker after loading. A custom image not already loaded/cached may fall back to black offline. Wallet balances remain authoritative on the server.

## Scope
Web/PWA only. Native Flutter screens, actual Apple/Google Wallet pass integrations, OTP/security configuration and billing rules are not modified. The source logo is kept at its existing quality; vector card elements do not make a low-resolution source logo higher-resolution.

## Validation
See `updates/card-polish/VALIDATION.md` for exact executed checks and limits. No claim of a full local Next.js production build or a real iPhone/server transaction is made without those tests.

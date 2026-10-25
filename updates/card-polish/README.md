# Install this targeted update

From your current Brewistan project root:

```bash
npm --prefix apps/web ci
node scripts/apply-card-polish.mjs
node scripts/card-polish-checks.mjs
python3 scripts/verify-manifest.py
npm --prefix apps/web run typecheck
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci npm --prefix apps/web run build
```

Do not commit/deploy if any command fails. The local build command uses temporary dummy values, not your live secrets. Review the current diff and successful CI/Vercel preview before merging.

Unzipping alone stages the update payload. The installer is required to integrate it into your current files without replacing your newer QR/auth logic. Payload source files end in .payload so repository-wide source tests do not accidentally compile duplicate, uninstalled files. The installer verifies them and writes normal .tsx/.ts/.css files into the app.

Detailed feature notes are in CARD_POLISH_UPDATE.md after installation. Validation limits are in VALIDATION.md alongside this file. Background selection is Dashboard > Branding > Cafe atmosphere, Bespoke only. No database migration, DNS update, secret update, or subscription change is performed.

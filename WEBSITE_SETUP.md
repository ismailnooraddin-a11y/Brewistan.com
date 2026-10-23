# Brewistan website - integrated release

Release: 23 October 2026
Target Vercel project: `brewistan-com-l2as`
Vercel Root Directory: `apps/web` (unchanged)

This is a full source bundle based on the premium update plus the database-regression
and Edge/Deno hotfixes already used in this conversation. It is not a separate app.
It contains the existing project and the new public website at the correct paths.
No database migrations, prices, roles or loyalty balances are changed by this website update.

## 1. Apply it using the same ZIP workflow

Save or commit any unrelated local work first. This full bundle overwrites delivered
project files. Compare newer changes before applying if you have edited the project
since commit `49bdb4d`; the ZIP cannot know about edits outside this conversation.

Upload `brewistan-website-complete-2026-10-23.zip` to the Codespaces repository root:

```bash
cd /workspaces/Brewistan.com

git switch brewistan-premium-update
unzip -o brewistan-website-complete-2026-10-23.zip
rm brewistan-website-complete-2026-10-23.zip
python3 scripts/verify-manifest.py
git status --short
```

After reviewing the changed files, commit to the existing pull-request branch:

```bash
git add -A
git commit -m "Add Brewistan owner marketing website and safe host routing"
git push origin brewistan-premium-update
```

Do not paste private keys or environment values into the website. Existing untracked
`.env.local` files and ignored keystores are not part of this archive.

## 2. Verify the preview first

The existing CI web job now runs `scripts/website-checks.mjs` in addition to the original
checks, and still performs the Next.js production build. No packages were added.

Local commands, with the normal project environment available:

```bash
npm ci --prefix apps/web
npm --prefix apps/web run typecheck
node --test scripts/audit-checks.mjs scripts/final-checks.mjs scripts/website-checks.mjs
node scripts/typecheck-helpers.mjs
npm --prefix apps/web run build
```

A build may regenerate the tracked `apps/web/next-env.d.ts`. This file was not changed
in this release. Review its diff before restoring it; the source manifest is designed
to verify the original delivered files, not build-generated output.

In the PR, open the successful preview for **brewistan-com-l2as**, not the old
`brewistan-com` project. The preview root now shows the public website.

Verify on an actual phone:

- Header/mobile navigation, all section links, FAQs, and keyboard focus.
- Add three demo stamps: 5/8 -> 6/8 -> 7/8 -> 8/8; reset and start again.
- Switch Classic, Signature and Bespoke sample card styles.
- All signup buttons target `https://dashboard.brewistan.com/login?signup=cafe`.
- Owner signup uses phone verification and continues to `/onboarding`.
- Existing owners can sign in and retain their cafe memberships.
- Customer QR entry and the customer wallet still work at the app subdomain.
- The admin panel remains restricted to the configured admin host.

**Preview signup links intentionally point to the existing owner domain.** They can
reach your live authentication system. Use a controlled test account or staging setup;
the marketing demo itself never creates users, awards stamps or calls Supabase.

The broader premium update still depends on its existing Supabase migrations and
function deployment. The supplied `Deploy Supabase` workflow runs after successful CI
on a push to main, if its required secrets and production environment are configured.
Vercel and Supabase are separate deployments; confirm backend readiness before testing
live owner onboarding. This website release adds no new migration.

## 3. One deployment, separate entry points

| Host / path | Experience |
|---|---|
| `brewistan.com/` | Public marketing website, after domain move |
| `www.brewistan.com/` | Redirect to `brewistan.com` once configured in Vercel |
| `brewistan-com-l2as.vercel.app/` | Public website; search indexing disabled |
| Generated preview URL `/` | Public website; search indexing disabled |
| `app.brewistan.com/` | Redirect to `/cards`, as before |
| `dashboard.brewistan.com/` | Redirect to the protected `/dashboard` |
| `admin.brewistan.com/` | Existing protected admin panel, with `ADMIN_HOST` configured |
| `/c/...`, `/cards`, `/scan` | Existing customer and staff routes preserved |
| Owner `/login?signup=cafe` | Cafe registration copy and fixed `/onboarding` destination |
| Normal owner `/login` | Fixed `/dashboard` destination after verification |
| Admin login | Existing admin-root destination |

The `signup=cafe` URL does not grant ownership or bypass approval. The existing
onboarding RPC and database membership rules remain authoritative. Staff and customers
do not choose roles on the public website.

The default `OWNER_HOSTS` is `dashboard.brewistan.com`. The default `CUSTOMER_HOSTS`
is `app.brewistan.com`. Existing `ADMIN_HOST`, Supabase and session-secret settings
must remain intact. No new secret is needed for the marketing page.

## 4. Move the public domains safely - do not delete first

A source ZIP cannot move Vercel domains or change Cloudflare DNS automatically.

1. Pass CI and review the intended project's preview. Merge/deploy the approved branch
   according to your existing release process. Verify the new production site at
   `brewistan-com-l2as.vercel.app` before changing public-domain ownership.
2. Open **brewistan-com-l2as > Settings > Domains** and add the existing
   `brewistan.com`. If Vercel offers **Move Domain**, confirm the destination is the
   intended project. Do the same for `www.brewistan.com`. Review any linked redirects
   Vercel includes in the move. Do not remove domains first.
3. Set `brewistan.com` to serve **Production**, with **no redirect to www**. The old
   screenshot showed an apex-to-www redirect; do not carry that redirect into a loop.
   Set `www.brewistan.com` to redirect to `https://brewistan.com`.
4. Keep `app.brewistan.com`, `dashboard.brewistan.com` and `admin.brewistan.com` attached
   to the current project exactly as they are. Follow the destination project's DNS
   instructions for apex/www only if Vercel reports that DNS changes are required.
   Do not change nameservers, mail records or other subdomains for this update.
5. Verify both public domains and all three app domains over HTTPS. Test signup with a
   controlled account. Only then disconnect/delete the old `brewistan-com` project,
   after confirming it has no domains or deployment you still need.

Official Vercel instructions, checked for this release:
https://vercel.com/docs/domains/working-with-domains/transfer-your-domain
https://vercel.com/docs/domains/working-with-domains/add-a-domain

## 5. Where to edit the website

| File | Purpose |
|---|---|
| `apps/web/public/website/index.html` | Copy, sections, SVG diagram, demo card markup, all signup links |
| `apps/web/public/website/site.css` | Isolated responsive styles and motion/contrast preferences |
| `apps/web/public/website/site.js` | Demo stamps, design selection and mobile menu enhancement |
| `apps/web/public/website/favicon.svg` | Website mark |
| `apps/web/public/website/social-card.png` | Social-sharing image |
| `apps/web/lib/site-routing.ts` | Pure host classification, safe destinations and website CSP |
| `apps/web/middleware.ts` | Public rewrite and existing protected-route guards |
| `apps/web/app/login/page.tsx` | Owner registration-specific login copy |
| `apps/web/app/login/LoginForm.tsx` | Fixed post-verification destination |
| `scripts/website-checks.mjs` | New regression tests run by CI |

The page is static HTML/CSS with a small progressive-enhancement script, served inside
the existing Next.js application. It does not load React, Supabase, third-party fonts,
tracking scripts or an animation framework for the public landing page. It uses system
fonts. Navigation, signup links and FAQ disclosure remain usable without JavaScript.
The existing dashboard/PWA dependencies and fonts are unchanged.

Do not add inline event handlers or inline scripts: the marketing page has a restrictive
Content Security Policy. Keep interactive code in `site.js` and styles in `site.css`.
When changing production branding or URLs, update the canonical URL, social metadata,
sitemap, owner signup links and social image together.

## 6. Product statements and launch limits

- The displayed ~1 minute and ~5 seconds are **design targets**, not measured production
  timings. The site labels them explicitly and states the relevant assumptions.
- The 14-day trial begins after cafe approval, reflecting the current database rules.
- New cafes start on Classic. Signup does not automatically grant a paid package.
- The supplied database prices are labelled placeholders in the source; they are not
  advertised as confirmed public prices. The owner dashboard remains the price source.
- Native Apple Wallet/Google Wallet passes and plastic cards are visibly **Planned**.
  This website does not implement pass issuance or physical-card support.
- Card/dashboard examples use illustrative data, not real cafe accounts or testimonials.
- The website is English. It does not change the app's existing language support.
- **Existing `/privacy` and `/terms` pages remain pre-launch drafts.** Supply and approve
  the operator's identity, support contact and required policies before public launch.
  This update does not invent legal/business details or certify compliance.
- Existing dependency-audit warnings and outstanding live/native integration work from
  the premium update are not resolved merely by adding this marketing site.

See `docs/website/VALIDATION.md` for exactly what was and was not verified.

## 7. Rollback

Before a domain move, rollback means reverting this website commit on the working
branch. Keep the existing working production deployment available. After a domain move,
rollback requires restoring a known-good deployment on the destination project or moving
the domains back to a verified source project. Do not delete the source project until
you have confirmed the new production experience and chosen a rollback plan.

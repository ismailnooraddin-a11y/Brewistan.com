# Brewistan

A production-grade, web-based café loyalty platform. Cafés replace paper stamp cards with branded digital cards — customers scan a QR, collect stamps, and baristas approve in realtime from their phones. No app install required.

Built with **Next.js 14 (App Router)** · **Supabase (Postgres + Auth + Realtime + Storage)** · **TypeScript** · **Zod**.

---

## Architecture at a glance

- **Three user types**: café owners (dashboard), staff/baristas (approve stamps), customers (wallet + scan pages).
- **Core loop**: customer scans QR → requests stamp → barista sees it live → approves → card increments → reward unlocks automatically.
- **Security model**: Row Level Security on every table + security-definer RPCs (`create_cafe`, `request_stamp`, `approve_stamp`, `reject_stamp`) so all privileged writes go through validated, auditable server functions.
- **No service-role key on the client.** Ever. Admin operations happen via RPCs with `auth.uid()` enforced.

---

## Prerequisites

- Node.js 18.17+ (tested on 20)
- A free [Supabase](https://supabase.com) project
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional but recommended for local dev / migration management)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once provisioned, grab these from **Settings → API**:
   - Project URL
   - `anon` public key
   - `service_role` key (server-only — never ship to the client)

### 3. Configure environment

Copy the example and fill in:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...   # optional, for future admin tooling
```

### 4. Run the database migrations

**Option A — Supabase Dashboard** (simplest):

1. Open your project → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/20260424000000_init.sql`, run it.
3. Paste the contents of `supabase/migrations/20260424000001_storage.sql`, run it.

**Option B — Supabase CLI** (better for version control):

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

This creates:

- 8 tables (`profiles`, `cafes`, `branches`, `staff`, `campaigns`, `loyalty_cards`, `stamp_requests`, `audit_log`)
- RLS policies on all of them
- Security-definer RPCs for all privileged writes
- A trigger that auto-creates `profiles` rows when auth users are created
- `updated_at` triggers everywhere
- Realtime publication for `stamp_requests` and `loyalty_cards`
- A public storage bucket for café logos with owner-scoped write policies

### 5. Configure Auth in Supabase

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (update for production)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` and your production equivalent

In **Authentication → Providers**:

- **Email**: enabled. For smoother dev, you can disable email confirmation (Auth → Providers → Email → "Confirm email").
- **Google** (optional): enable and provide OAuth credentials. Set the callback URL to your Supabase project's `/auth/v1/callback` endpoint (Supabase shows you the exact URL when you enable the provider).

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the core loop works

1. **Café owner signs up** at `/get-started`. They provide their personal details + café info. On submit, the app calls the `create_cafe` RPC, which atomically creates the café, upgrades their profile role to `cafe_owner`, and seeds a default `Main Branch`.
2. **Owner creates a campaign** at `/dashboard/campaigns` (e.g., "8 stamps → free drink"). Sets status to `active`. Only one campaign can be active per café at any time (enforced by a partial unique index).
3. **Owner prints the QR** from `/dashboard/brand`. The QR encodes `https://yoursite.com/c/{slug}`.
4. **Customer scans** → lands on `/c/{slug}` → signs up in ~20 seconds → taps **Request stamp**.
5. The client calls the `request_stamp` RPC, which:
   - Validates the café is active
   - Finds the active campaign
   - Upserts a `loyalty_cards` row for that customer+campaign
   - Creates a `stamp_requests` row in `pending` state (15-minute expiry)
   - Prevents spamming by returning the existing pending request if one exists
6. **Barista** sees the request appear instantly on `/dashboard/stamp-requests` (via Supabase Realtime subscription) and taps **Approve**.
7. The client calls the `approve_stamp` RPC, which:
   - Verifies the caller is staff for that café (`is_cafe_staff`)
   - Increments the card's stamp count
   - If the threshold is reached, resets stamps to 0 and increments `rewards_earned`
   - Marks the request `approved` and logs to `audit_log`
   - Returns `{ approved: true, reward_issued: boolean }`
8. **Customer's screen updates** in realtime via the subscription on that specific request row.

---

## Project structure

```
app/
  (marketing)/page.tsx       # Landing
  (auth)/
    get-started/page.tsx     # Sign up / sign in
    reset-password/page.tsx
  auth/
    callback/route.ts        # OAuth + magic link exchange
    signout/route.ts
  dashboard/                 # Owner dashboard (role-gated)
    layout.tsx
    page.tsx
    brand/page.tsx
    campaigns/page.tsx
    staff/page.tsx
    branches/page.tsx
    settings/page.tsx
    stamp-requests/page.tsx  # Realtime barista approval screen
  c/[cafeSlug]/page.tsx      # Customer QR landing
  wallet/page.tsx            # Customer's cards
  error.tsx, not-found.tsx

components/
  marketing/PhoneMockup.tsx
  dashboard/                 # Sidebar, BrandEditor, CampaignsManager, etc.
  customer/                  # LoyaltyCard, CustomerStampButton

lib/
  supabase/                  # browser, server, middleware clients
  queries/                   # typed server-side data access
  schemas/                   # Zod validation
  database.types.ts          # DB types (regenerate with `npm run db:types`)
  env.ts                     # Runtime env validation
  utils/

supabase/migrations/
  20260424000000_init.sql    # Schema + RLS + RPCs + realtime
  20260424000001_storage.sql # Logo bucket + policies

middleware.ts                # Session refresh + route protection
```

---

## Deploying to production

### Vercel (recommended)

1. Push to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Add environment variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your production domain, e.g. `https://brewistan.com`)
   - `SUPABASE_SERVICE_ROLE_KEY` (optional)
4. Deploy.
5. In Supabase **Auth → URL Configuration**, update Site URL and add your Vercel domain to Redirect URLs.

### Any Node host

`npm run build` → `npm run start`. Requires the same env vars.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:types` | Regenerate `lib/database.types.ts` from your linked Supabase project |

---

## Security notes

- **Every table has RLS enabled.** Nothing reads or writes without a policy.
- **No direct inserts** into `cafes`, `loyalty_cards`, or `stamp_requests` — all go through `security definer` RPCs that run with postgres privileges but re-check `auth.uid()`.
- **Role escalation is impossible** for users: the `profiles.role` update policy blocks self-upgrades. Role changes happen only inside the `create_cafe` RPC.
- **Storage policies** are keyed on the first path segment (`{cafe_id}/...`), so an owner can only upload to their own café's folder.
- **Service role key is never imported into client code.** The only place it could be used is a future server-only admin route.
- **Security headers** set in `next.config.js`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer policy.

---

## What's intentionally left for later

These are solid next steps, not bugs:

- **Logo upload UI** — the storage bucket and policies are ready; wire `<input type="file">` in the BrandEditor.
- **Staff phone OTP login** — the `staff` table is ready; add Supabase phone auth + a simplified `/staff` screen.
- **Audit log viewer** — `audit_log` table is populated; build a read-only page for owners.
- **Internationalization (Arabic, Kurdish) + RTL** — use `next-intl` and add `dir="rtl"` switching.
- **Analytics dashboard** — aggregate `stamp_requests` by day/week for insights.
- **Tests** — Vitest + Playwright for the stamp-request loop.
- **CI** — GitHub Actions workflow for lint + typecheck + build.

---

## License

Proprietary. All rights reserved.

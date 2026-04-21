# Brewistan

Digital loyalty stamp cards for independent coffee shops.
Built with Next.js 14 (App Router), Supabase, and Tailwind.

A warm editorial design — cream paper, espresso ink, ember accents, Fraunces + Inter — with tasteful scroll-reveal and hover motion throughout.

## Quick start

1. Copy `.env.local.example` to `.env.local` and fill in your Supabase project URL and anon key.
2. Run the SQL in `supabase/schema.sql` against your Supabase project (SQL Editor).
3. Install and run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Project structure

```
src/
  app/
    page.tsx              — Landing page
    signup/page.tsx       — Signup
    signin/page.tsx       — Signin
    dashboard/page.tsx    — Authenticated dashboard
    auth/callback/route.ts — OAuth callback
    auth/signout/route.ts  — Signout
    layout.tsx             — Root layout (fonts)
    globals.css            — Design tokens, components, motion
  components/
    Header.tsx             — Sticky, compressing on scroll
    Footer.tsx
    Logo.tsx               — Custom coffee-bean mark
    Reveal.tsx             — IntersectionObserver scroll-reveal
    StampCard.tsx          — Animated hero stamp card
    Marquee.tsx            — Rolling café names
  lib/supabase/
    client.ts              — Browser client
    server.ts              — Server client
    middleware.ts          — Session refresh + route guards
middleware.ts              — Root middleware
supabase/schema.sql        — Schema + triggers + RLS
tailwind.config.ts         — Design tokens + keyframes
```

## Features

- Landing page, signup, signin, authed dashboard
- Email + password auth via Supabase
- Automatic `merchants` + `cafes` + `rewards` rows created on signup via a Postgres trigger
- Row-level security locks every café owner to their own data
- Scroll-revealed sections, hover-lift cards, sticky compressing header, animated stamp card, rolling marquee, paper-grain overlay
- Fraunces display serif paired with Inter body; warm cream palette with ember accent
- Full `prefers-reduced-motion` support

## Design system

**Palette**

| Token            | Hex       | Purpose                       |
| ---------------- | --------- | ----------------------------- |
| `paper`          | `#F6F1E8` | Warm cream background         |
| `paper-card`     | `#FCF9F2` | Cards, form fields            |
| `paper-tint`     | `#EFE7D6` | Subtle tinted surfaces        |
| `ink`            | `#1A1410` | Espresso text / dark surfaces |
| `ink-soft`       | `#3D2F26` | Body copy                     |
| `ember`          | `#B8532C` | Accent — links, highlights    |
| `ember-glow`     | `#F3C48A` | Warm glow on dark surfaces    |

**Typography**

- Display — **Fraunces** (variable serif, italic for emphasis)
- Body — **Inter**

**Motion**

- Enter easing: `cubic-bezier(0.22, 1, 0.36, 1)`
- Move easing: `cubic-bezier(0.25, 1, 0.5, 1)`
- Hover-in: 150-200ms, hover-out: 200-250ms
- Scroll reveals staggered 80ms, capped at ~320ms total
- Full reduced-motion fallback

## Deployment

Push to GitHub → import to Vercel → add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars → deploy. Point your domain via DNS to Vercel.

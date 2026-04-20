# Brewistan

Digital loyalty stamp cards for independent coffee shops. Built with Next.js 14, Supabase, and Tailwind.

## Quick start

1. Copy `.env.local.example` to `.env.local` and fill in your Supabase project URL and anon key.
2. Run the SQL in `supabase/schema.sql` against your Supabase project (SQL Editor).
3. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project structure

- `src/app/` — Next.js App Router pages (`/`, `/signup`, `/signin`, `/dashboard`)
- `src/app/auth/` — OAuth callback and signout route handlers
- `src/components/` — Header, Footer
- `src/lib/supabase/` — Supabase browser, server, and middleware clients
- `middleware.ts` — Protects `/dashboard`, redirects authenticated users away from auth pages
- `supabase/schema.sql` — Database schema, triggers, and row-level security policies

## Features included

- Landing page, signup, signin, and dashboard
- Email + password auth via Supabase
- Automatic merchant + café + rewards rows created on signup via a Postgres trigger
- Row-level security locks every café owner to their own data
- Apple-style design in a warm neutral palette (Inter font)

## Deployment

See `SETUP_GUIDE.docx` for full click-by-click deployment instructions (Supabase → GitHub → Vercel → Cloudflare DNS for brewistan.com).

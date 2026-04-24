# Brewistan Production Frontend

Production-ready Next.js + Supabase foundation for Brewistan.

## Deploy steps
1. Create a Supabase project.
2. Open Supabase SQL Editor and run `sql/brewistan_schema.sql`.
3. In Supabase Auth > URL Configuration:
   - Site URL: your Vercel domain
   - Redirect URLs: `https://your-domain.com/auth/callback`
4. Upload this project to GitHub.
5. Import to Vercel as a Next.js project.
6. Add environment variables from `.env.example`.
7. Deploy.

## Features included
- Landing page
- Get Started page with café registration, sign in, password reset, and staff login
- Supabase email magic link / password auth foundation
- Café owner dashboard
- Brand/card theme editor
- Campaign builder for 8/10/12/custom stamp campaigns
- Staff and role management UI
- Branch management UI
- Supabase SQL schema with RLS policies

## Notes
- Staff phone/password login is implemented as a UI and database-ready flow. For the safest production release, create staff auth users through Supabase Auth using email or phone OTP. If you insist on phone+password without OTP, implement it as a secure server-side function with hashing and rate limits before going live.

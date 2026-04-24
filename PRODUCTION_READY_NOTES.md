# Brewistan Production-Ready Upgrade Notes

This package is an upgraded version of the uploaded Brewistan project. It keeps the existing Next.js + Supabase architecture and adds the most important production hardening layers.

## Added / improved

### Backend
- Staff invitation workflow via `staff_invitations` table and RPCs:
  - `invite_staff_member`
  - `accept_staff_invitation`
- Reward redemption workflow via `reward_redemptions` table and `redeem_reward` RPC.
- SaaS subscription/account state on `cafes`:
  - trialing, active, past_due, cancelled, blocked
  - Stripe customer/subscription placeholders
  - trial end date
- Abuse/fraud control fields on stamp requests:
  - device fingerprint
  - QR nonce
  - order amount
  - risk score
  - risk reason
- Operational/fraud event table: `app_events`.
- `approve_stamp` now creates a redeemable reward record when the customer reaches the campaign threshold.
- RLS policies added for invitations, reward redemptions, and operational events.

### Frontend
- Staff manager now creates invitations instead of requiring the staff member to already exist.
- Staff flow is more realistic for SaaS onboarding.

## Still requires configuration before commercial launch

These items cannot be fully completed without your live accounts/API keys:

1. Stripe products, prices, webhook secret, and billing portal URL.
2. Email provider such as Resend, SendGrid, Postmark, or Supabase Edge Function email integration.
3. Production Supabase environment variables in Vercel.
4. Real domain and `NEXT_PUBLIC_SITE_URL` value.
5. Final brand visuals, logo, and café card visual identity.
6. Legal pages: Terms, Privacy Policy, Data Processing wording.

## Recommended deployment order

1. Upload this project to GitHub.
2. In Supabase SQL editor, run migrations in order:
   - `20260424000000_init.sql`
   - `20260424000001_storage.sql`
   - `20260424000002_production_hardening.sql`
3. In Vercel, add environment variables from `.env.example`.
4. Deploy.
5. Test these flows:
   - Owner signup
   - Café creation
   - Campaign creation
   - Customer scan
   - Stamp request
   - Staff approval
   - Reward earning
   - Reward redemption

## Important

This is now much closer to a real production SaaS foundation, but no software should be called commercially production-ready until it is tested with the actual Supabase project, payment provider, email provider, domain, and live user flows.

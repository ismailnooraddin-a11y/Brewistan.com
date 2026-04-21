-- ============================================================
--  Migration 001 — reward configured_at
--  Run this in the Supabase SQL Editor (one time).
--  Adds a timestamp that tracks whether the merchant has
--  actually saved their reward settings, vs. the default row.
-- ============================================================

alter table public.rewards
  add column if not exists configured_at timestamptz;

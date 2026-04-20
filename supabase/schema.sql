-- ============================================================
-- Brewistan — Database Schema
-- Run this in Supabase SQL Editor (one time, top to bottom)
-- ============================================================

-- Safety: extensions we rely on
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- MERCHANTS
-- One row per café owner account. id = auth.users.id
-- ============================================================
create table if not exists public.merchants (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CAFES
-- One row per café location. A merchant can have many cafés
-- (multi-location is a paid upgrade in product, but schema allows it)
-- ============================================================
create table if not exists public.cafes (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  name          text not null,
  city          text not null,
  address       text,
  logo_url      text,
  hours_json    jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists cafes_merchant_id_idx on public.cafes(merchant_id);

-- ============================================================
-- REWARDS
-- Loyalty program configuration per café
-- ============================================================
create table if not exists public.rewards (
  id                  uuid primary key default gen_random_uuid(),
  cafe_id             uuid not null references public.cafes(id) on delete cascade,
  stamps_needed       int  not null default 9 check (stamps_needed between 5 and 15),
  headstart_stamps    int  not null default 1 check (headstart_stamps >= 0),
  reward_type         text not null default 'same'
                      check (reward_type in ('same','any','addon','pastry','discount')),
  reward_text         text not null default 'Free coffee on us',
  expiry_months       int  not null default 6 check (expiry_months between 1 and 120),
  min_purchase_iqd    int  not null default 0 check (min_purchase_iqd >= 0),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists rewards_cafe_id_idx on public.rewards(cafe_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- Keep updated_at fresh on every row update
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists merchants_touch on public.merchants;
create trigger merchants_touch
  before update on public.merchants
  for each row execute function public.touch_updated_at();

drop trigger if exists cafes_touch on public.cafes;
create trigger cafes_touch
  before update on public.cafes
  for each row execute function public.touch_updated_at();

drop trigger if exists rewards_touch on public.rewards;
create trigger rewards_touch
  before update on public.rewards
  for each row execute function public.touch_updated_at();

-- ============================================================
-- SIGNUP TRIGGER
-- When auth.users inserts, create merchant + cafe rows from the
-- metadata we passed in supabase.auth.signUp()
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_cafe_id uuid;
begin
  insert into public.merchants (id, full_name, phone, email)
  values (
    new.id,
    meta ->> 'full_name',
    meta ->> 'phone',
    new.email
  )
  on conflict (id) do nothing;

  if coalesce(meta ->> 'cafe_name', '') <> '' then
    insert into public.cafes (merchant_id, name, city)
    values (
      new.id,
      meta ->> 'cafe_name',
      coalesce(meta ->> 'city', '')
    )
    returning id into new_cafe_id;

    insert into public.rewards (cafe_id)
    values (new_cafe_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table locked down. A merchant can only see their own rows.
-- ============================================================
alter table public.merchants enable row level security;
alter table public.cafes     enable row level security;
alter table public.rewards   enable row level security;

-- MERCHANTS: owner reads and updates own row
drop policy if exists merchants_select_own on public.merchants;
create policy merchants_select_own on public.merchants
  for select using (auth.uid() = id);

drop policy if exists merchants_update_own on public.merchants;
create policy merchants_update_own on public.merchants
  for update using (auth.uid() = id);

-- CAFES: owner full CRUD on own cafés
drop policy if exists cafes_select_own on public.cafes;
create policy cafes_select_own on public.cafes
  for select using (auth.uid() = merchant_id);

drop policy if exists cafes_insert_own on public.cafes;
create policy cafes_insert_own on public.cafes
  for insert with check (auth.uid() = merchant_id);

drop policy if exists cafes_update_own on public.cafes;
create policy cafes_update_own on public.cafes
  for update using (auth.uid() = merchant_id);

drop policy if exists cafes_delete_own on public.cafes;
create policy cafes_delete_own on public.cafes
  for delete using (auth.uid() = merchant_id);

-- REWARDS: owner full CRUD via parent café ownership
drop policy if exists rewards_select_own on public.rewards;
create policy rewards_select_own on public.rewards
  for select using (
    exists (select 1 from public.cafes c
            where c.id = rewards.cafe_id and c.merchant_id = auth.uid())
  );

drop policy if exists rewards_insert_own on public.rewards;
create policy rewards_insert_own on public.rewards
  for insert with check (
    exists (select 1 from public.cafes c
            where c.id = rewards.cafe_id and c.merchant_id = auth.uid())
  );

drop policy if exists rewards_update_own on public.rewards;
create policy rewards_update_own on public.rewards
  for update using (
    exists (select 1 from public.cafes c
            where c.id = rewards.cafe_id and c.merchant_id = auth.uid())
  );

drop policy if exists rewards_delete_own on public.rewards;
create policy rewards_delete_own on public.rewards
  for delete using (
    exists (select 1 from public.cafes c
            where c.id = rewards.cafe_id and c.merchant_id = auth.uid())
  );

-- Done.

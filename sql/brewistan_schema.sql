-- Brewistan Supabase schema
-- Run this in Supabase SQL Editor.
-- It creates a production-oriented multi-cafe loyalty foundation with RLS.

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin
  create type public.user_role as enum ('platform_admin','cafe_owner','branch_manager','barista','customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('invited','active','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('draft','active','paused','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reward_type as enum ('discount_percent','free_item');
exception when duplicate_object then null; end $$;

-- ---------- CORE USER PROFILE ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  avatar_url text,
  gender text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_len check (phone is null or length(phone) >= 7)
);

create unique index if not exists profiles_phone_unique on public.profiles(phone) where phone is not null;
create unique index if not exists profiles_email_unique on public.profiles(lower(email)) where email is not null;

-- ---------- CAFE ----------
create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  cafe_name text not null,
  cafe_slug text generated always as (lower(regexp_replace(cafe_name, '[^a-zA-Z0-9]+', '-', 'g'))) stored,
  legal_name text,
  contact_email text,
  contact_phone text not null,
  address text not null,
  city text default 'Erbil',
  country text default 'Iraq',
  logo_url text,
  status text not null default 'active',
  card_theme jsonb not null default '{"primary":"#2F4A3D","secondary":"#D7B56D","surface":"#FFF7E8","opacity":0.96,"watermark":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cafes_owner_id_idx on public.cafes(owner_id);

-- ---------- BRANCHES ----------
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  branch_name text not null,
  address text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branches_cafe_id_idx on public.branches(cafe_id);

-- ---------- CAFE MEMBERS / STAFF ----------
create table if not exists public.cafe_members (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text not null,
  role public.user_role not null check (role in ('cafe_owner','branch_manager','barista')),
  status public.member_status not null default 'active',
  avatar_url text,
  permission_summary text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cafe_id, phone)
);

create index if not exists cafe_members_cafe_id_idx on public.cafe_members(cafe_id);
create index if not exists cafe_members_phone_idx on public.cafe_members(phone);

-- ---------- CAMPAIGNS ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  campaign_name text not null,
  stamp_target int not null check (stamp_target between 1 and 100),
  final_reward_type public.reward_type not null default 'free_item',
  final_reward_label text not null default 'Free drink',
  early_reward_enabled boolean not null default true,
  early_reward_stamp int,
  early_reward_type public.reward_type default 'discount_percent',
  early_reward_value numeric(5,2) default 25,
  early_reward_label text default '25% off one drink',
  status public.campaign_status not null default 'draft',
  applies_to_all_branches boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  reset_after_final_reward boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint early_stamp_valid check (early_reward_stamp is null or early_reward_stamp < stamp_target)
);

create index if not exists campaigns_cafe_id_idx on public.campaigns(cafe_id);

create table if not exists public.campaign_branches (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  primary key (campaign_id, branch_id)
);

-- ---------- CUSTOMERS AND CARDS ----------
create table if not exists public.customer_cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  card_number text not null default upper(substr(gen_random_uuid()::text,1,8)),
  current_stamps int not null default 0 check (current_stamps >= 0),
  cycle_number int not null default 1,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id, cafe_id, campaign_id, cycle_number)
);

create index if not exists customer_cards_customer_idx on public.customer_cards(customer_id);
create index if not exists customer_cards_cafe_idx on public.customer_cards(cafe_id);

-- ---------- STAMP REQUESTS ----------
create table if not exists public.stamp_requests (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.customer_cards(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  note text
);

create index if not exists stamp_requests_cafe_status_idx on public.stamp_requests(cafe_id,status,requested_at desc);

-- ---------- STAMPS / REDEMPTIONS ----------
create table if not exists public.stamp_transactions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.customer_cards(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  approved_by uuid references public.profiles(id),
  stamp_count int not null default 1 check (stamp_count between 1 and 20),
  source_request_id uuid references public.stamp_requests(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.customer_cards(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  reward_type public.reward_type not null,
  reward_label text not null,
  reward_value numeric(8,2),
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz not null default now(),
  cycle_number int not null
);

-- ---------- AUDIT ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  cafe_id uuid references public.cafes(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- UPDATED_AT TRIGGER ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$ declare t text; begin
  foreach t in array array['profiles','cafes','branches','cafe_members','campaigns','customer_cards'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- PROFILE CREATION ON AUTH SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- ---------- HELPER FUNCTIONS ----------
create or replace function public.is_cafe_member(target_cafe uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.cafe_members cm
    where cm.cafe_id = target_cafe
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ) or exists (
    select 1 from public.cafes c
    where c.id = target_cafe and c.owner_id = auth.uid()
  );
$$;

create or replace function public.member_role(target_cafe uuid)
returns public.user_role language sql stable security definer as $$
  select coalesce(
    (select 'cafe_owner'::public.user_role from public.cafes c where c.id = target_cafe and c.owner_id = auth.uid()),
    (select cm.role from public.cafe_members cm where cm.cafe_id = target_cafe and cm.user_id = auth.uid() and cm.status = 'active' limit 1),
    'customer'::public.user_role
  );
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.cafes enable row level security;
alter table public.branches enable row level security;
alter table public.cafe_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_branches enable row level security;
alter table public.customer_cards enable row level security;
alter table public.stamp_requests enable row level security;
alter table public.stamp_transactions enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());

-- Cafes
create policy "cafes_owner_select" on public.cafes for select using (owner_id = auth.uid() or public.is_cafe_member(id));
create policy "cafes_owner_insert" on public.cafes for insert with check (owner_id = auth.uid());
create policy "cafes_owner_update" on public.cafes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Branches
create policy "branches_member_select" on public.branches for select using (public.is_cafe_member(cafe_id));
create policy "branches_owner_manager_write" on public.branches for all using (public.member_role(cafe_id) in ('cafe_owner','branch_manager')) with check (public.member_role(cafe_id) in ('cafe_owner','branch_manager'));

-- Cafe members
create policy "members_member_select" on public.cafe_members for select using (public.is_cafe_member(cafe_id));
create policy "members_owner_manager_write" on public.cafe_members for all using (public.member_role(cafe_id) in ('cafe_owner','branch_manager')) with check (public.member_role(cafe_id) in ('cafe_owner','branch_manager'));

-- Campaigns
create policy "campaigns_public_active_select" on public.campaigns for select using (status = 'active' or public.is_cafe_member(cafe_id));
create policy "campaigns_owner_manager_write" on public.campaigns for all using (public.member_role(cafe_id) in ('cafe_owner','branch_manager')) with check (public.member_role(cafe_id) in ('cafe_owner','branch_manager'));

-- Campaign branches
create policy "campaign_branches_member_select" on public.campaign_branches for select using (exists(select 1 from public.campaigns c where c.id = campaign_id and public.is_cafe_member(c.cafe_id)));
create policy "campaign_branches_owner_manager_write" on public.campaign_branches for all using (exists(select 1 from public.campaigns c where c.id = campaign_id and public.member_role(c.cafe_id) in ('cafe_owner','branch_manager')));

-- Customer cards
create policy "cards_customer_or_cafe_select" on public.customer_cards for select using (customer_id = auth.uid() or public.is_cafe_member(cafe_id));
create policy "cards_customer_insert" on public.customer_cards for insert with check (customer_id = auth.uid());
create policy "cards_staff_update" on public.customer_cards for update using (customer_id = auth.uid() or public.is_cafe_member(cafe_id));

-- Stamp requests
create policy "requests_customer_or_staff_select" on public.stamp_requests for select using (customer_id = auth.uid() or public.is_cafe_member(cafe_id));
create policy "requests_customer_insert" on public.stamp_requests for insert with check (customer_id = auth.uid());
create policy "requests_staff_update" on public.stamp_requests for update using (public.is_cafe_member(cafe_id));

-- Transactions and rewards
create policy "transactions_customer_or_staff_select" on public.stamp_transactions for select using (customer_id = auth.uid() or public.is_cafe_member(cafe_id));
create policy "transactions_staff_insert" on public.stamp_transactions for insert with check (public.is_cafe_member(cafe_id));
create policy "redemptions_customer_or_staff_select" on public.reward_redemptions for select using (customer_id = auth.uid() or public.is_cafe_member(cafe_id));
create policy "redemptions_staff_insert" on public.reward_redemptions for insert with check (public.is_cafe_member(cafe_id));

-- Audit
create policy "audit_cafe_member_select" on public.audit_logs for select using (cafe_id is null or public.is_cafe_member(cafe_id));
create policy "audit_authenticated_insert" on public.audit_logs for insert with check (actor_id = auth.uid());


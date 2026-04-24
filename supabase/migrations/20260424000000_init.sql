-- ============================================================================
-- Brewistan — production schema
-- Extensions, enums, tables, RLS, triggers, RPCs
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type user_role as enum ('customer', 'cafe_owner', 'branch_manager', 'barista', 'admin');
create type stamp_request_status as enum ('pending', 'approved', 'rejected', 'expired');
create type campaign_status as enum ('draft', 'active', 'paused', 'archived');

-- ============================================================================
-- PROFILES (mirrors auth.users, adds app metadata)
-- ============================================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        citext unique,
  phone        text,
  role         user_role not null default 'customer',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- ============================================================================
-- CAFES
-- ============================================================================

create table public.cafes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete restrict,
  slug           citext unique not null,
  cafe_name      text not null,
  contact_email  citext not null,
  contact_phone  text not null,
  city           text not null default 'Erbil',
  address        text not null,
  logo_url       text,
  -- branding
  card_primary   text not null default '#254435',
  card_secondary text not null default '#5f8063',
  card_text      text not null default '#ffffff',
  card_opacity   numeric(3,2) not null default 1.00 check (card_opacity between 0.5 and 1.0),
  watermark_on   boolean not null default true,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index cafes_owner_idx on public.cafes(owner_id);
create index cafes_slug_idx  on public.cafes(slug);

-- ============================================================================
-- BRANCHES
-- ============================================================================

create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes(id) on delete cascade,
  name        text not null,
  address     text not null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cafe_id, name)
);

create index branches_cafe_idx on public.branches(cafe_id);

-- ============================================================================
-- STAFF (barista/manager membership linking profiles → cafe/branch)
-- ============================================================================

create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        user_role not null check (role in ('branch_manager', 'barista')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (cafe_id, profile_id)
);

create index staff_cafe_idx    on public.staff(cafe_id);
create index staff_profile_idx on public.staff(profile_id);
create index staff_branch_idx  on public.staff(branch_id);

-- ============================================================================
-- CAMPAIGNS (stamp plans per cafe)
-- ============================================================================

create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  cafe_id          uuid not null references public.cafes(id) on delete cascade,
  name             text not null,
  stamps_required  int  not null check (stamps_required between 3 and 50),
  reward_text      text not null,
  status           campaign_status not null default 'draft',
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index campaigns_cafe_idx   on public.campaigns(cafe_id);
create index campaigns_status_idx on public.campaigns(status);

-- Only one active campaign per cafe at a time (product decision; can be relaxed later)
create unique index campaigns_one_active_per_cafe
  on public.campaigns(cafe_id) where status = 'active';

-- ============================================================================
-- LOYALTY CARDS (one row per customer × campaign)
-- ============================================================================

create table public.loyalty_cards (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  cafe_id         uuid not null references public.cafes(id) on delete cascade,
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  stamps_count    int  not null default 0 check (stamps_count >= 0),
  rewards_earned  int  not null default 0 check (rewards_earned >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (customer_id, campaign_id)
);

create index cards_customer_idx on public.loyalty_cards(customer_id);
create index cards_cafe_idx     on public.loyalty_cards(cafe_id);
create index cards_campaign_idx on public.loyalty_cards(campaign_id);

-- ============================================================================
-- STAMP REQUESTS (customer-initiated, staff-approved)
-- ============================================================================

create table public.stamp_requests (
  id             uuid primary key default gen_random_uuid(),
  card_id        uuid not null references public.loyalty_cards(id) on delete cascade,
  cafe_id        uuid not null references public.cafes(id) on delete cascade,
  branch_id      uuid references public.branches(id) on delete set null,
  customer_id    uuid not null references public.profiles(id) on delete cascade,
  status         stamp_request_status not null default 'pending',
  requested_at   timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.profiles(id) on delete set null,
  expires_at     timestamptz not null default (now() + interval '15 minutes'),
  note           text
);

create index stamp_req_cafe_status_idx   on public.stamp_requests(cafe_id, status);
create index stamp_req_customer_idx      on public.stamp_requests(customer_id);
create index stamp_req_pending_idx       on public.stamp_requests(cafe_id) where status = 'pending';

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  cafe_id     uuid references public.cafes(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_cafe_idx  on public.audit_log(cafe_id);
create index audit_actor_idx on public.audit_log(actor_id);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated  before update on public.profiles      for each row execute function public.tg_set_updated_at();
create trigger trg_cafes_updated     before update on public.cafes         for each row execute function public.tg_set_updated_at();
create trigger trg_branches_updated  before update on public.branches      for each row execute function public.tg_set_updated_at();
create trigger trg_campaigns_updated before update on public.campaigns     for each row execute function public.tg_set_updated_at();
create trigger trg_cards_updated     before update on public.loyalty_cards for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- Auto-create profile on auth.users insert
-- Role and metadata pulled from raw_user_meta_data if present
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  meta_role    user_role;
  meta_name    text;
  meta_phone   text;
begin
  meta_name  := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  meta_phone := new.raw_user_meta_data->>'phone';
  meta_role  := coalesce(
    (new.raw_user_meta_data->>'role')::user_role,
    'customer'::user_role
  );

  insert into public.profiles (id, full_name, email, phone, role)
  values (new.id, meta_name, new.email, meta_phone, meta_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- ============================================================================

create or replace function public.is_cafe_owner(p_cafe_id uuid)
returns boolean
security definer
set search_path = public
language sql stable as $$
  select exists (
    select 1 from public.cafes
    where id = p_cafe_id and owner_id = auth.uid()
  );
$$;

create or replace function public.is_cafe_staff(p_cafe_id uuid)
returns boolean
security definer
set search_path = public
language sql stable as $$
  select exists (
    select 1 from public.staff
    where cafe_id = p_cafe_id and profile_id = auth.uid() and is_active = true
  ) or public.is_cafe_owner(p_cafe_id);
$$;

create or replace function public.current_role()
returns user_role
security definer
set search_path = public
language sql stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- CAFE CREATION RPC (atomic: cafe + owner role upgrade)
-- ============================================================================

create or replace function public.create_cafe(
  p_cafe_name     text,
  p_slug          text,
  p_contact_email text,
  p_contact_phone text,
  p_city          text,
  p_address       text
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_cafe_id uuid;
  v_uid     uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Validate slug format (lowercase letters, numbers, hyphens only, 3-40 chars)
  if p_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$' then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;

  -- Upgrade the current profile to cafe_owner if still customer
  update public.profiles
     set role = 'cafe_owner'
   where id = v_uid and role = 'customer';

  insert into public.cafes (
    owner_id, slug, cafe_name, contact_email, contact_phone, city, address
  ) values (
    v_uid, lower(p_slug), p_cafe_name, lower(p_contact_email), p_contact_phone, p_city, p_address
  )
  returning id into v_cafe_id;

  -- Seed a default branch
  insert into public.branches (cafe_id, name, address, phone)
  values (v_cafe_id, 'Main Branch', p_address, p_contact_phone);

  insert into public.audit_log (actor_id, cafe_id, action, target_type, target_id)
  values (v_uid, v_cafe_id, 'cafe.created', 'cafe', v_cafe_id::text);

  return v_cafe_id;
end;
$$;

-- ============================================================================
-- STAMP REQUEST LIFECYCLE RPCs
-- ============================================================================

-- Customer initiates a stamp request. Creates or reuses their loyalty card.
create or replace function public.request_stamp(
  p_cafe_slug text,
  p_branch_id uuid default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_cafe_id     uuid;
  v_campaign_id uuid;
  v_card_id     uuid;
  v_request_id  uuid;
  v_customer_id uuid := auth.uid();
  v_existing    uuid;
begin
  if v_customer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select id into v_cafe_id from public.cafes where slug = lower(p_cafe_slug) and is_active = true;
  if v_cafe_id is null then
    raise exception 'CAFE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id into v_campaign_id
    from public.campaigns
   where cafe_id = v_cafe_id and status = 'active'
   order by starts_at desc
   limit 1;

  if v_campaign_id is null then
    raise exception 'NO_ACTIVE_CAMPAIGN' using errcode = 'P0002';
  end if;

  -- Upsert loyalty card
  insert into public.loyalty_cards (customer_id, cafe_id, campaign_id)
  values (v_customer_id, v_cafe_id, v_campaign_id)
  on conflict (customer_id, campaign_id) do update set updated_at = now()
  returning id into v_card_id;

  -- Prevent spamming: block if a pending request already exists for this customer/cafe
  select id into v_existing
    from public.stamp_requests
   where customer_id = v_customer_id
     and cafe_id = v_cafe_id
     and status = 'pending'
     and expires_at > now()
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.stamp_requests (card_id, cafe_id, branch_id, customer_id)
  values (v_card_id, v_cafe_id, p_branch_id, v_customer_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- Staff approves a stamp request. Increments card, issues reward if threshold reached.
create or replace function public.approve_stamp(p_request_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_req            public.stamp_requests%rowtype;
  v_card           public.loyalty_cards%rowtype;
  v_campaign       public.campaigns%rowtype;
  v_reward_issued  boolean := false;
  v_staff_id       uuid := auth.uid();
begin
  if v_staff_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req from public.stamp_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_cafe_staff(v_req.cafe_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED' using errcode = '22023';
  end if;

  if v_req.expires_at <= now() then
    update public.stamp_requests set status = 'expired', resolved_at = now() where id = p_request_id;
    raise exception 'REQUEST_EXPIRED' using errcode = '22023';
  end if;

  select * into v_card from public.loyalty_cards where id = v_req.card_id for update;
  select * into v_campaign from public.campaigns where id = v_card.campaign_id;

  update public.loyalty_cards
     set stamps_count = stamps_count + 1
   where id = v_card.id;

  -- Reward: if stamps reaches required threshold, reset + increment rewards_earned
  if (v_card.stamps_count + 1) >= v_campaign.stamps_required then
    update public.loyalty_cards
       set stamps_count = 0,
           rewards_earned = rewards_earned + 1
     where id = v_card.id;
    v_reward_issued := true;
  end if;

  update public.stamp_requests
     set status = 'approved', resolved_at = now(), resolved_by = v_staff_id
   where id = p_request_id;

  insert into public.audit_log (actor_id, cafe_id, action, target_type, target_id, metadata)
  values (v_staff_id, v_req.cafe_id, 'stamp.approved', 'stamp_request', p_request_id::text,
          jsonb_build_object('card_id', v_card.id, 'reward_issued', v_reward_issued));

  return jsonb_build_object('approved', true, 'reward_issued', v_reward_issued);
end;
$$;

create or replace function public.reject_stamp(p_request_id uuid, p_note text default null)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_cafe_id  uuid;
  v_staff_id uuid := auth.uid();
begin
  if v_staff_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select cafe_id into v_cafe_id from public.stamp_requests where id = p_request_id and status = 'pending';
  if v_cafe_id is null then
    raise exception 'REQUEST_NOT_FOUND_OR_RESOLVED' using errcode = 'P0002';
  end if;

  if not public.is_cafe_staff(v_cafe_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  update public.stamp_requests
     set status = 'rejected', resolved_at = now(), resolved_by = v_staff_id, note = p_note
   where id = p_request_id;

  insert into public.audit_log (actor_id, cafe_id, action, target_type, target_id, metadata)
  values (v_staff_id, v_cafe_id, 'stamp.rejected', 'stamp_request', p_request_id::text,
          jsonb_build_object('note', p_note));
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.cafes          enable row level security;
alter table public.branches       enable row level security;
alter table public.staff          enable row level security;
alter table public.campaigns      enable row level security;
alter table public.loyalty_cards  enable row level security;
alter table public.stamp_requests enable row level security;
alter table public.audit_log      enable row level security;

-- --- profiles --------------------------------------------------------------
create policy profiles_select_self
  on public.profiles for select
  using (id = auth.uid());

create policy profiles_update_self
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
-- role cannot be self-upgraded; must go through RPC

-- --- cafes -----------------------------------------------------------------
create policy cafes_public_read
  on public.cafes for select
  using (is_active = true);
-- Public read lets customers discover cafes by slug; sensitive data stays elsewhere

create policy cafes_owner_update
  on public.cafes for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Insert is handled exclusively via create_cafe() RPC (security definer)
-- No direct insert policy = direct inserts are blocked

-- --- branches --------------------------------------------------------------
create policy branches_public_read
  on public.branches for select
  using (is_active = true);

create policy branches_owner_all
  on public.branches for all
  using (public.is_cafe_owner(cafe_id))
  with check (public.is_cafe_owner(cafe_id));

-- --- staff -----------------------------------------------------------------
create policy staff_select_own_cafe
  on public.staff for select
  using (public.is_cafe_staff(cafe_id) or profile_id = auth.uid());

create policy staff_owner_manage
  on public.staff for all
  using (public.is_cafe_owner(cafe_id))
  with check (public.is_cafe_owner(cafe_id));

-- --- campaigns -------------------------------------------------------------
create policy campaigns_public_read_active
  on public.campaigns for select
  using (status = 'active' or public.is_cafe_staff(cafe_id));

create policy campaigns_owner_manage
  on public.campaigns for all
  using (public.is_cafe_owner(cafe_id))
  with check (public.is_cafe_owner(cafe_id));

-- --- loyalty_cards ---------------------------------------------------------
create policy cards_select_own
  on public.loyalty_cards for select
  using (customer_id = auth.uid() or public.is_cafe_staff(cafe_id));

-- No direct insert/update from clients; all through RPCs

-- --- stamp_requests --------------------------------------------------------
create policy stamp_req_select_involved
  on public.stamp_requests for select
  using (customer_id = auth.uid() or public.is_cafe_staff(cafe_id));

-- All writes through RPCs (request_stamp, approve_stamp, reject_stamp)

-- --- audit_log -------------------------------------------------------------
create policy audit_cafe_owner_read
  on public.audit_log for select
  using (cafe_id is not null and public.is_cafe_owner(cafe_id));

-- ============================================================================
-- GRANTS for RPCs
-- ============================================================================

grant execute on function public.create_cafe       to authenticated;
grant execute on function public.request_stamp     to authenticated;
grant execute on function public.approve_stamp     to authenticated;
grant execute on function public.reject_stamp      to authenticated;
grant execute on function public.is_cafe_owner     to authenticated;
grant execute on function public.is_cafe_staff     to authenticated;
grant execute on function public.current_role      to authenticated;

-- ============================================================================
-- REALTIME — publish tables needed for live updates
-- ============================================================================

alter publication supabase_realtime add table public.stamp_requests;
alter publication supabase_realtime add table public.loyalty_cards;

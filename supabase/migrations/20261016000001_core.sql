-- =============================================================================
-- Brewistan loyalty platform: core schema
-- Every stamp, reward and permission rule lives here or in Edge Functions.
-- Clients never write totals; progress is derived from immutable events.
-- =============================================================================

create type public.cafe_tier as enum ('classic', 'signature', 'bespoke');
create type public.cafe_status as enum ('pending', 'active', 'rejected', 'suspended', 'closed');
create type public.member_role as enum ('owner', 'barista');
create type public.member_status as enum ('invited', 'active', 'revoked');
create type public.event_status as enum ('accepted', 'rejected', 'voided', 'quarantined');
create type public.reward_status as enum ('available', 'redeemed', 'expired', 'voided');
create type public.redemption_status as enum ('accepted', 'duplicate', 'rejected', 'voided');
create type public.push_status as enum ('draft', 'approved', 'sending', 'sent', 'cancelled');
create type public.sub_status as enum ('trial', 'pending_payment', 'active', 'past_due', 'cancelled');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,                      -- digits only, e.g. 9647701234567
  first_name text check (char_length(first_name) <= 40),
  last_name text check (char_length(last_name) <= 40),
  locale text not null default 'en' check (locale in ('en', 'ar', 'ckb')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  public_key text not null,               -- Ed25519 public key, base64url
  platform text not null check (platform in ('android', 'ios')),
  push_token text,
  app_version text,
  cert_expires_at timestamptz,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index devices_user_idx on public.devices (user_id);

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null check (char_length(name) between 2 and 80),
  instagram_url text check (char_length(instagram_url) <= 200),
  business_registration_no text check (char_length(business_registration_no) <= 60),
  verification_code text not null default upper(substr(md5(random()::text), 1, 6)),
  verification_photo_path text,
  tier public.cafe_tier not null default 'classic',
  status public.cafe_status not null default 'pending',
  rejection_reason text,
  rejected_at timestamptz,
  approved_at timestamptz,
  logo_path text,
  brand jsonb not null default '{}'::jsonb,   -- {"primary":"#1a1a1a","accent":"#c8a96a","template":"noir"}
  created_at timestamptz not null default now()
);
create index cafes_owner_idx on public.cafes (owner_id);
create index cafes_status_idx on public.cafes (status);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  address text check (char_length(address) <= 200),
  timezone text not null default 'Asia/Baghdad',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index branches_cafe_idx on public.branches (cafe_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,  -- null = all branches
  user_id uuid references public.profiles (id) on delete cascade,     -- null until the invitee signs in
  phone text not null,
  role public.member_role not null,
  status public.member_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  confirmed_at timestamptz,               -- owner confirmed a new barista
  revoked_at timestamptz
);
create unique index memberships_one_open on public.memberships (cafe_id, phone, role) where status <> 'revoked';
create index memberships_user_idx on public.memberships (user_id);
create index memberships_phone_idx on public.memberships (phone);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  version int not null,
  stamps_required int not null default 8 check (stamps_required between 3 and 20),
  reward_label jsonb not null default '{"en":"Free Coffee","ar":"قهوة مجانية","ckb":"قاوەی بەخۆڕایی"}'::jsonb,
  reward_expiry_days int not null default 180 check (reward_expiry_days between 30 and 365),
  cooldown_minutes int not null default 120 check (cooldown_minutes between 30 and 1440),
  max_banked_rewards int not null default 2 check (max_banked_rewards between 1 and 5),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cafe_id, version)
);
create unique index campaigns_one_active on public.campaigns (cafe_id) where active;

create table public.user_cafe_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  stamps_in_current int not null default 0,
  total_stamps int not null default 0,
  completed_puzzles int not null default 0,
  last_stamp_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);
create index progress_cafe_idx on public.user_cafe_progress (cafe_id);

create table public.stamp_events (
  id uuid primary key,                    -- UUID v7 generated on the scanner (idempotency key)
  user_id uuid references public.profiles (id) on delete set null,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  staff_id uuid references public.profiles (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  customer_device_id uuid,
  scanned_at timestamptz not null,
  received_at timestamptz not null default now(),
  offline boolean not null default false,
  status public.event_status not null,
  reason text,
  flagged boolean not null default false
);
create index stamp_events_cafe_idx on public.stamp_events (cafe_id, scanned_at desc);
create index stamp_events_user_idx on public.stamp_events (user_id, cafe_id, scanned_at desc);
create index stamp_events_staff_idx on public.stamp_events (staff_id, scanned_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  source_event_id uuid,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.reward_status not null default 'available',
  redeemed_at timestamptz,
  reminded_30 boolean not null default false,
  reminded_7 boolean not null default false
);
create index rewards_user_idx on public.rewards (user_id, cafe_id, status);
create index rewards_expiry_idx on public.rewards (status, expires_at);

create table public.redemptions (
  id uuid primary key,                    -- UUID v7 generated on the scanner
  reward_id uuid references public.rewards (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  staff_id uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz not null,
  received_at timestamptz not null default now(),
  offline boolean not null default false,
  status public.redemption_status not null,
  reason text,
  voided_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  void_reason text
);
create index redemptions_cafe_idx on public.redemptions (cafe_id, redeemed_at desc);
create index redemptions_staff_idx on public.redemptions (staff_id, redeemed_at desc);

create table public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title jsonb not null,                   -- {"en": "...", "ar": "...", "ckb": "..."}
  body jsonb not null,
  scheduled_at timestamptz not null,
  status public.push_status not null default 'draft',
  approval_hash text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  audience_count int,
  delivered_count int,
  created_at timestamptz not null default now()
);
create index push_campaigns_due_idx on public.push_campaigns (status, scheduled_at);

create table public.step_up_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null,
  subject_id uuid,
  payload_hash text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index step_up_user_idx on public.step_up_challenges (user_id, created_at desc);

create table public.push_deliveries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  day date not null,
  campaign_id uuid references public.push_campaigns (id) on delete set null,
  primary key (user_id, cafe_id, day)
);

create table public.notification_mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

create table public.pricing (
  tier public.cafe_tier primary key,
  monthly_iqd int not null check (monthly_iqd >= 0)
);
-- Placeholder prices: change them before launch (dashboard reads this table).
insert into public.pricing (tier, monthly_iqd) values
  ('classic', 50000), ('signature', 100000), ('bespoke', 250000);

create table public.subscriptions (
  cafe_id uuid primary key references public.cafes (id) on delete cascade,
  tier public.cafe_tier not null default 'classic',
  status public.sub_status not null,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.payment_reports (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  reported_by uuid not null references public.profiles (id),
  method text not null check (method in ('zain_cash', 'fib', 'bank_transfer')),
  amount_iqd int not null check (amount_iqd > 0),
  months int not null default 1 check (months between 1 and 12),
  reference text not null check (char_length(reference) between 3 and 100),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.otp_log (
  id bigserial primary key,
  phone_hash text not null,
  purpose text not null,
  delivered boolean not null default true,
  created_at timestamptz not null default now()
);
create index otp_log_phone_idx on public.otp_log (phone_hash, created_at desc);
create index otp_log_time_idx on public.otp_log (created_at);

create table public.audit_log (
  id bigserial primary key,
  cafe_id uuid references public.cafes (id) on delete set null,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_cafe_idx on public.audit_log (cafe_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- Admin with MFA (aal2). Use for every admin permission.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Admin row exists (any assurance level). Only used to route admins to MFA.
create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- No end-user context (service role / migrations) or an MFA admin.
create or replace function public.is_privileged() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_admin();
$$;

create or replace function public.is_cafe_owner(p_cafe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where cafe_id = p_cafe and user_id = auth.uid() and role = 'owner' and status = 'active');
$$;

create or replace function public.is_cafe_member(p_cafe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where cafe_id = p_cafe and user_id = auth.uid() and status = 'active');
$$;

-- Pseudonymous display name, e.g. "Ahmed M."
create or replace function public.display_name(p_first text, p_last text) returns text
language sql immutable as $$
  select coalesce(nullif(trim(p_first), ''), 'Guest')
         || case when coalesce(trim(p_last), '') = '' then '' else ' ' || upper(left(trim(p_last), 1)) || '.' end;
$$;

create or replace function public.tier_for(p_completed int) returns text
language sql immutable as $$
  select case
    when p_completed >= 25 then 'matte_black'
    when p_completed >= 10 then 'gold'
    when p_completed >= 3 then 'silver'
    else 'bronze' end;
$$;

-- Tenant-scoped pseudonymous customer reference (owners never see user ids).
create or replace function public.customer_ref(p_user uuid, p_cafe uuid) returns text
language sql immutable as $$
  select 'C-' || upper(substr(md5(p_user::text || ':' || p_cafe::text), 1, 8));
$$;

create or replace function public.normalize_phone(p text) returns text
language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- New auth user -> profile, and activate any pending staff invites for the phone.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, nullif(public.normalize_phone(new.phone), ''))
  on conflict (id) do nothing;

  if coalesce(new.phone, '') <> '' then
    update public.memberships
       set user_id = new.id, status = 'active', activated_at = now()
     where phone = public.normalize_phone(new.phone) and status = 'invited' and user_id is null;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users cannot change their own phone or deletion marker.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged() then
    new.phone := old.phone;
    new.deleted_at := old.deleted_at;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Cafe creation: always pending, owner = caller, fresh verification code.
create or replace function public.cafes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.owner_id := auth.uid();
  end if;
  new.status := 'pending';
  new.tier := 'classic';
  new.approved_at := null;
  new.rejection_reason := null;
  new.rejected_at := null;
  new.verification_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  return new;
end $$;

create trigger cafes_before_insert before insert on public.cafes
  for each row execute function public.cafes_before_insert();

-- After creation: owner membership, first campaign version, trial or pending payment.
create or replace function public.cafes_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_had_trial boolean;
begin
  select phone into v_phone from public.profiles where id = new.owner_id;

  insert into public.memberships (cafe_id, user_id, phone, role, status, activated_at, confirmed_at, invited_by)
  values (new.id, new.owner_id, coalesce(v_phone, 'owner-' || new.owner_id::text), 'owner', 'active', now(), now(), new.owner_id);

  insert into public.campaigns (cafe_id, version, created_by) values (new.id, 1, new.owner_id);

  -- One free trial per cafe, matched on owner phone and business registration number.
  select exists (
    select 1 from public.cafes c
    join public.profiles p on p.id = c.owner_id
    where c.id <> new.id
      and (p.phone = v_phone
           or (new.business_registration_no is not null
               and lower(trim(c.business_registration_no)) = lower(trim(new.business_registration_no))))
  ) into v_had_trial;

  insert into public.subscriptions (cafe_id, tier, status, trial_ends_at)
  values (new.id, 'classic',
          case when v_had_trial then 'pending_payment'::public.sub_status else 'trial'::public.sub_status end,
          null);  -- the 14-day trial clock starts at approval

  insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id)
  values (new.id, new.owner_id, 'cafe_created', 'cafe', new.id::text);
  return new;
end $$;

create trigger cafes_after_insert after insert on public.cafes
  for each row execute function public.cafes_after_insert();

-- Owners cannot change approval state, tier, owner or verification code.
create or replace function public.cafes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged() then
    new.status := old.status;
    new.approved_at := old.approved_at;
    new.rejection_reason := old.rejection_reason;
    new.rejected_at := old.rejected_at;
    new.owner_id := old.owner_id;
    new.verification_code := old.verification_code;
    new.tier := old.tier;
    new.created_at := old.created_at;
    -- Custom logos are Signature and Bespoke only.
    if old.tier = 'classic' then
      new.logo_path := old.logo_path;
    end if;
    -- Full custom branding is Bespoke only; Signature may pick a template.
    if old.tier = 'classic' then
      new.brand := old.brand;
    elsif old.tier = 'signature' then
      new.brand := jsonb_build_object('template', coalesce(new.brand ->> 'template', 'noir'));
    end if;
  end if;
  return new;
end $$;

create trigger cafes_guard before update on public.cafes
  for each row execute function public.cafes_guard();

-- A cafe leaving the platform archives its cards in customer wallets.
create or replace function public.cafes_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then
    update public.user_cafe_progress set archived = true where cafe_id = new.id;
  end if;
  if new.status = 'active' and old.status = 'pending' then
    update public.subscriptions
       set trial_ends_at = case when status = 'trial' then now() + interval '14 days' else trial_ends_at end
     where cafe_id = new.id;
  end if;
  return new;
end $$;

create trigger cafes_after_update after update on public.cafes
  for each row execute function public.cafes_after_update();

-- Push campaigns: send window 09:00-21:00 Baghdad time, scheduled in the future.
create or replace function public.push_campaigns_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_local_hour int;
begin
  if not public.is_privileged() then
    if tg_op = 'UPDATE' then
      new.status := case when new.status = 'cancelled' then 'cancelled'::public.push_status else old.status end;
      new.approval_hash := old.approval_hash;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
      new.sent_at := old.sent_at;
      new.cafe_id := old.cafe_id;
      new.created_by := old.created_by;
    else
      new.status := 'draft';
      new.created_by := auth.uid();
      new.approval_hash := null;
      new.approved_at := null;
      new.approved_by := null;
    end if;

    if new.status = 'draft' then
      v_local_hour := extract(hour from (new.scheduled_at at time zone 'Asia/Baghdad'));
      if v_local_hour < 9 or v_local_hour >= 21 then
        raise exception 'send_window: campaigns must be scheduled between 09:00 and 21:00 Baghdad time'
          using errcode = '22023';
      end if;
      if new.scheduled_at < now() + interval '10 minutes' then
        raise exception 'schedule_too_soon: schedule at least 10 minutes ahead' using errcode = '22023';
      end if;
      if coalesce(new.title ->> 'en', '') = '' or coalesce(new.body ->> 'en', '') = '' then
        raise exception 'missing_english: an English title and body are required' using errcode = '22023';
      end if;
      if char_length(coalesce(new.body ->> 'en', '')) > 240 then
        raise exception 'body_too_long: keep the message under 240 characters' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger push_campaigns_guard before insert or update on public.push_campaigns
  for each row execute function public.push_campaigns_guard();

-- -----------------------------------------------------------------------------
-- Core business logic (called by Edge Functions with the service role)
-- -----------------------------------------------------------------------------

-- The barista membership valid for a cafe/branch at a point in time.
create or replace function public.barista_membership(p_cafe uuid, p_staff uuid, p_branch uuid, p_at timestamptz)
returns setof public.memberships
language sql stable security definer set search_path = public as $$
  select m.* from public.memberships m
  where m.cafe_id = p_cafe
    and m.user_id = p_staff
    and m.role = 'barista'
    and m.activated_at is not null
    and m.activated_at <= p_at + interval '5 minutes'
    and (m.revoked_at is null or m.revoked_at > p_at)
    and (m.branch_id is null or p_branch is null or m.branch_id = p_branch)
  order by m.activated_at desc
  limit 1;
$$;

create or replace function public.process_stamp(
  p_event_id uuid,
  p_user_id uuid,
  p_cafe_id uuid,
  p_branch_id uuid,
  p_staff_id uuid,
  p_customer_device_id uuid,
  p_scanned_at timestamptz,
  p_offline boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.stamp_events%rowtype;
  v_cafe public.cafes%rowtype;
  v_member public.memberships%rowtype;
  v_campaign public.campaigns%rowtype;
  v_progress public.user_cafe_progress%rowtype;
  v_status public.event_status := 'accepted';
  v_reason text;
  v_flagged boolean := false;
  v_reward_id uuid;
  v_banked int := 0;
  v_rejections int;
  v_new_count int;
  v_completed boolean := false;
begin
  -- Idempotency: the same event id always returns its first result.
  select * into v_existing from public.stamp_events where id = p_event_id;
  if found then
    return jsonb_build_object('status', v_existing.status, 'reason', v_existing.reason, 'duplicate', true);
  end if;

  select * into v_cafe from public.cafes where id = p_cafe_id;
  if not found then
    raise exception 'cafe_not_found';
  end if;
  if v_cafe.status <> 'active' then
    v_status := 'rejected'; v_reason := 'cafe_inactive';
  end if;

  if v_status = 'accepted' and p_branch_id is not null
     and not exists (select 1 from public.branches where id = p_branch_id and cafe_id = p_cafe_id and active) then
    v_status := 'rejected'; v_reason := 'branch_mismatch';
  end if;

  if v_status = 'accepted' then
    select * into v_member from public.barista_membership(p_cafe_id, p_staff_id, p_branch_id, p_scanned_at);
    if not found then
      if p_offline and exists (select 1 from public.memberships
                               where cafe_id = p_cafe_id and user_id = p_staff_id and role = 'barista') then
        v_status := 'quarantined'; v_reason := 'staff_not_valid_at_scan';
      else
        v_status := 'rejected'; v_reason := 'not_staff';
      end if;
    elsif p_offline and v_member.status = 'revoked' then
      v_status := 'quarantined'; v_reason := 'staff_revoked_before_sync';
    end if;
  end if;

  if v_status = 'accepted' and p_user_id = p_staff_id then
    v_status := 'rejected'; v_reason := 'self_scan';
  end if;

  if v_status = 'accepted' and exists (select 1 from public.memberships
                                       where cafe_id = p_cafe_id and user_id = p_user_id and status = 'active') then
    v_status := 'rejected'; v_reason := 'staff_account';
  end if;

  select * into v_campaign from public.campaigns where cafe_id = p_cafe_id and active;
  if v_status = 'accepted' and not found then
    v_status := 'rejected'; v_reason := 'no_campaign';
  end if;

  if v_status = 'accepted' then
    insert into public.user_cafe_progress (user_id, cafe_id) values (p_user_id, p_cafe_id)
    on conflict do nothing;
    -- Row lock serialises concurrent scans of the same customer at the same cafe.
    select * into v_progress from public.user_cafe_progress
     where user_id = p_user_id and cafe_id = p_cafe_id for update;

    if exists (
      select 1 from public.stamp_events
      where user_id = p_user_id and cafe_id = p_cafe_id and status = 'accepted'
        and scanned_at > p_scanned_at - make_interval(mins => v_campaign.cooldown_minutes)
        and scanned_at < p_scanned_at + make_interval(mins => v_campaign.cooldown_minutes)) then
      v_status := case when p_offline then 'voided'::public.event_status else 'rejected'::public.event_status end;
      v_reason := 'cooldown';
    end if;
  end if;

  if v_status = 'accepted' then
    select count(*) into v_banked from public.rewards
     where user_id = p_user_id and cafe_id = p_cafe_id and status = 'available' and expires_at > now();
    if v_banked >= v_campaign.max_banked_rewards then
      v_status := case when p_offline then 'voided'::public.event_status else 'rejected'::public.event_status end;
      v_reason := 'reward_cap';
    end if;
  end if;

  if v_status = 'accepted' and v_member.confirmed_at is null
     and p_scanned_at < v_member.activated_at + interval '24 hours' then
    v_flagged := true;
  end if;

  insert into public.stamp_events (id, user_id, cafe_id, branch_id, staff_id, campaign_id, customer_device_id,
                                   scanned_at, offline, status, reason, flagged)
  values (p_event_id, p_user_id, p_cafe_id, p_branch_id, p_staff_id, v_campaign.id, p_customer_device_id,
          p_scanned_at, p_offline, v_status, v_reason, v_flagged);

  if v_reason = 'cooldown' then
    select count(*) into v_rejections from public.stamp_events
     where cafe_id = p_cafe_id and staff_id = p_staff_id and reason = 'cooldown'
       and scanned_at > now() - interval '7 days';
    if v_rejections = 3 then
      insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id, reason)
      values (p_cafe_id, p_staff_id, 'cooldown_alert', 'staff', p_staff_id::text,
              'Three cooldown rejections by one barista within seven days');
    end if;
  end if;

  if v_status <> 'accepted' then
    return jsonb_build_object('status', v_status, 'reason', v_reason);
  end if;

  v_new_count := v_progress.stamps_in_current + 1;
  if v_new_count >= v_campaign.stamps_required then
    v_completed := true;
    v_new_count := 0;
    insert into public.rewards (user_id, cafe_id, campaign_id, source_event_id, issued_at, expires_at)
    values (p_user_id, p_cafe_id, v_campaign.id, p_event_id, p_scanned_at,
            p_scanned_at + make_interval(days => v_campaign.reward_expiry_days))
    returning id into v_reward_id;
  end if;

  update public.user_cafe_progress
     set stamps_in_current = v_new_count,
         total_stamps = total_stamps + 1,
         completed_puzzles = completed_puzzles + case when v_completed then 1 else 0 end,
         last_stamp_at = greatest(coalesce(last_stamp_at, p_scanned_at), p_scanned_at),
         archived = false
   where user_id = p_user_id and cafe_id = p_cafe_id;

  return jsonb_build_object(
    'status', 'accepted',
    'stamps', case when v_completed then v_campaign.stamps_required else v_new_count end,
    'required', v_campaign.stamps_required,
    'puzzle_completed', v_completed,
    'reward_id', v_reward_id,
    'flagged', v_flagged);
end $$;

create or replace function public.process_redemption(
  p_redemption_id uuid,
  p_reward_id uuid,
  p_user_id uuid,
  p_cafe_id uuid,
  p_branch_id uuid,
  p_staff_id uuid,
  p_redeemed_at timestamptz,
  p_offline boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.redemptions%rowtype;
  v_cafe public.cafes%rowtype;
  v_member public.memberships%rowtype;
  v_reward public.rewards%rowtype;
  v_status public.redemption_status := 'accepted';
  v_reason text;
begin
  select * into v_existing from public.redemptions where id = p_redemption_id;
  if found then
    return jsonb_build_object('status', v_existing.status, 'reason', v_existing.reason, 'duplicate', true);
  end if;

  select * into v_cafe from public.cafes where id = p_cafe_id;
  if not found then
    raise exception 'cafe_not_found';
  end if;
  if v_cafe.status <> 'active' then
    v_status := 'rejected'; v_reason := 'cafe_inactive';
  end if;

  if v_status = 'accepted' then
    select * into v_member from public.barista_membership(p_cafe_id, p_staff_id, p_branch_id, p_redeemed_at);
    if not found then
      v_status := 'rejected'; v_reason := 'not_staff';
    end if;
  end if;

  if v_status = 'accepted' and (p_user_id = p_staff_id or exists (
      select 1 from public.memberships where cafe_id = p_cafe_id and user_id = p_user_id and status = 'active')) then
    v_status := 'rejected'; v_reason := 'staff_account';
  end if;

  if v_status = 'accepted' then
    if p_reward_id is not null then
      select * into v_reward from public.rewards
       where id = p_reward_id and user_id = p_user_id and cafe_id = p_cafe_id for update;
    else
      select * into v_reward from public.rewards
       where user_id = p_user_id and cafe_id = p_cafe_id and status = 'available'
       order by issued_at limit 1 for update;
    end if;

    if not found then
      v_status := 'rejected'; v_reason := 'no_reward';
    elsif v_reward.status <> 'available' then
      v_status := case when p_offline then 'duplicate'::public.redemption_status else 'rejected'::public.redemption_status end;
      v_reason := 'reward_' || v_reward.status::text;
    elsif v_reward.expires_at < p_redeemed_at then
      v_status := 'rejected'; v_reason := 'reward_expired';
    end if;
  end if;

  insert into public.redemptions (id, reward_id, user_id, cafe_id, branch_id, staff_id, redeemed_at, offline, status, reason)
  values (p_redemption_id, v_reward.id, p_user_id, p_cafe_id, p_branch_id, p_staff_id, p_redeemed_at, p_offline, v_status, v_reason);

  if v_status = 'accepted' then
    update public.rewards set status = 'redeemed', redeemed_at = p_redeemed_at where id = v_reward.id;
  elsif v_status = 'duplicate' then
    insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id, reason)
    values (p_cafe_id, p_staff_id, 'duplicate_redemption', 'redemption', p_redemption_id::text,
            'Offline redemption of a reward that was already used');
  end if;

  return jsonb_build_object('status', v_status, 'reason', v_reason, 'reward_id', v_reward.id);
end $$;

create or replace function public.expire_rewards() returns int
language sql security definer set search_path = public as $$
  with x as (
    update public.rewards set status = 'expired'
    where status = 'available' and expires_at < now()
    returning 1)
  select count(*)::int from x;
$$;

-- -----------------------------------------------------------------------------
-- Owner RPCs (called from the web dashboard with the owner's session)
-- -----------------------------------------------------------------------------

create or replace function public.update_campaign(
  p_cafe uuid, p_stamps_required int, p_reward_label jsonb, p_reward_expiry_days int,
  p_cooldown_minutes int, p_max_banked_rewards int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_version int;
  v_id uuid;
begin
  if not public.is_cafe_owner(p_cafe) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.campaigns where cafe_id = p_cafe;
  update public.campaigns set active = false where cafe_id = p_cafe and active;
  insert into public.campaigns (cafe_id, version, stamps_required, reward_label, reward_expiry_days,
                                cooldown_minutes, max_banked_rewards, created_by)
  values (p_cafe, v_version, p_stamps_required, p_reward_label, p_reward_expiry_days,
          p_cooldown_minutes, p_max_banked_rewards, auth.uid())
  returning id into v_id;
  insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id, meta)
  values (p_cafe, auth.uid(), 'campaign_updated', 'campaign', v_id::text, jsonb_build_object('version', v_version));
  return v_id;
end $$;

create or replace function public.void_redemption(p_redemption uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_r public.redemptions%rowtype;
begin
  select * into v_r from public.redemptions where id = p_redemption for update;
  if not found or not (public.is_cafe_owner(v_r.cafe_id) or public.is_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v_r.status <> 'accepted' then
    raise exception 'not_voidable' using errcode = '22023';
  end if;
  update public.redemptions
     set status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = p_reason
   where id = p_redemption;
  update public.rewards set status = 'available', redeemed_at = null
   where id = v_r.reward_id and status = 'redeemed' and expires_at > now();
  insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id, reason)
  values (v_r.cafe_id, auth.uid(), 'redemption_voided', 'redemption', p_redemption::text, p_reason);
end $$;

create or replace function public.owner_customers(p_cafe uuid)
returns table (
  customer_ref text, display_name text, total_stamps int, stamps_in_current int,
  completed_puzzles int, available_rewards int, last_visit timestamptz, archived boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
    select public.customer_ref(p.user_id, p.cafe_id),
           public.display_name(pr.first_name, pr.last_name),
           p.total_stamps, p.stamps_in_current, p.completed_puzzles,
           (select count(*)::int from public.rewards r
             where r.user_id = p.user_id and r.cafe_id = p.cafe_id and r.status = 'available'),
           p.last_stamp_at, p.archived
    from public.user_cafe_progress p
    join public.profiles pr on pr.id = p.user_id
    where p.cafe_id = p_cafe
    order by p.last_stamp_at desc nulls last;
end $$;

create or replace function public.owner_staff_report(p_cafe uuid, p_since timestamptz)
returns table (
  membership_id uuid, display_name text, phone text, role public.member_role, status public.member_status,
  branch_name text, confirmed boolean, invited_at timestamptz, stamps int, rejected int, flagged int,
  redemptions int, offline_redemptions int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
    select m.id,
           case when m.user_id is null then 'Invited' else public.display_name(pr.first_name, pr.last_name) end,
           m.phone, m.role, m.status, b.name, m.confirmed_at is not null, m.invited_at,
           (select count(*)::int from public.stamp_events e
             where e.staff_id = m.user_id and e.cafe_id = p_cafe and e.status = 'accepted' and e.scanned_at >= p_since),
           (select count(*)::int from public.stamp_events e
             where e.staff_id = m.user_id and e.cafe_id = p_cafe and e.status <> 'accepted' and e.scanned_at >= p_since),
           (select count(*)::int from public.stamp_events e
             where e.staff_id = m.user_id and e.cafe_id = p_cafe and e.flagged and e.scanned_at >= p_since),
           (select count(*)::int from public.redemptions r
             where r.staff_id = m.user_id and r.cafe_id = p_cafe and r.status = 'accepted' and r.redeemed_at >= p_since),
           (select count(*)::int from public.redemptions r
             where r.staff_id = m.user_id and r.cafe_id = p_cafe and r.status = 'accepted' and r.offline
               and r.redeemed_at >= p_since)
    from public.memberships m
    left join public.profiles pr on pr.id = m.user_id
    left join public.branches b on b.id = m.branch_id
    where m.cafe_id = p_cafe
    order by m.role, m.status, m.invited_at desc;
end $$;

create or replace function public.owner_overview(p_cafe uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'stamps_today', (select count(*) from public.stamp_events where cafe_id = p_cafe and status = 'accepted'
                      and scanned_at >= date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad'),
    'stamps_30d', (select count(*) from public.stamp_events where cafe_id = p_cafe and status = 'accepted'
                    and scanned_at >= now() - interval '30 days'),
    'redemptions_30d', (select count(*) from public.redemptions where cafe_id = p_cafe and status = 'accepted'
                         and redeemed_at >= now() - interval '30 days'),
    'active_customers_30d', (select count(distinct user_id) from public.stamp_events where cafe_id = p_cafe
                              and status = 'accepted' and scanned_at >= now() - interval '30 days'),
    'new_customers_30d', (select count(*) from public.user_cafe_progress where cafe_id = p_cafe
                           and created_at >= now() - interval '30 days'),
    'total_customers', (select count(*) from public.user_cafe_progress where cafe_id = p_cafe),
    'flagged_7d', (select count(*) from public.stamp_events where cafe_id = p_cafe and flagged
                    and scanned_at >= now() - interval '7 days'),
    'quarantined', (select count(*) from public.stamp_events where cafe_id = p_cafe and status = 'quarantined'),
    'alerts_7d', (select count(*) from public.audit_log where cafe_id = p_cafe
                   and action in ('cooldown_alert', 'duplicate_redemption')
                   and created_at >= now() - interval '7 days'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'stamps', d.stamps, 'redemptions', d.redemptions)
                                        order by d.day), '[]'::jsonb)
              from (
                select g.day::date as day,
                       (select count(*) from public.stamp_events e where e.cafe_id = p_cafe and e.status = 'accepted'
                          and (e.scanned_at at time zone 'Asia/Baghdad')::date = g.day::date) as stamps,
                       (select count(*) from public.redemptions r where r.cafe_id = p_cafe and r.status = 'accepted'
                          and (r.redeemed_at at time zone 'Asia/Baghdad')::date = g.day::date) as redemptions
                from generate_series((now() at time zone 'Asia/Baghdad')::date - 29,
                                     (now() at time zone 'Asia/Baghdad')::date, interval '1 day') as g(day)
              ) d)
  ) into v;
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- Admin RPCs (MFA required through is_admin)
-- -----------------------------------------------------------------------------

create or replace function public.admin_review_payment(p_report uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.payment_reports%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
  select * into v from public.payment_reports where id = p_report and status = 'pending' for update;
  if not found then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  update public.payment_reports
     set status = case when p_approve then 'confirmed' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report;
  if p_approve then
    update public.subscriptions
       set status = 'active',
           current_period_end = greatest(coalesce(current_period_end, now()), now()) + make_interval(months => v.months)
     where cafe_id = v.cafe_id;
  end if;
  insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id)
  values (v.cafe_id, auth.uid(), case when p_approve then 'payment_confirmed' else 'payment_rejected' end,
          'payment_report', p_report::text);
end $$;

create or replace function public.admin_set_tier(p_cafe uuid, p_tier public.cafe_tier) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
  update public.cafes set tier = p_tier where id = p_cafe;
  update public.subscriptions set tier = p_tier where cafe_id = p_cafe;
  insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id, meta)
  values (p_cafe, auth.uid(), 'tier_changed', 'cafe', p_cafe::text, jsonb_build_object('tier', p_tier));
end $$;

-- Records why an admin opened a cafe's verification files.
create or replace function public.admin_log_view(p_cafe uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  insert into public.audit_log (cafe_id, actor_id, action, entity, entity_id, reason)
  values (p_cafe, auth.uid(), 'admin_viewed_personal_data', 'cafe', p_cafe::text, p_reason);
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.devices enable row level security;
alter table public.cafes enable row level security;
alter table public.branches enable row level security;
alter table public.memberships enable row level security;
alter table public.campaigns enable row level security;
alter table public.user_cafe_progress enable row level security;
alter table public.stamp_events enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.step_up_challenges enable row level security;
alter table public.push_deliveries enable row level security;
alter table public.notification_mutes enable row level security;
alter table public.pricing enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_reports enable row level security;
alter table public.otp_log enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy admins_select on public.admins for select to authenticated
  using (user_id = auth.uid());

create policy devices_select on public.devices for select to authenticated
  using (user_id = auth.uid());

create policy cafes_select on public.cafes for select to authenticated
  using (owner_id = auth.uid() or public.is_cafe_member(id) or public.is_admin());
create policy cafes_insert on public.cafes for insert to authenticated
  with check (owner_id = auth.uid());
create policy cafes_update on public.cafes for update to authenticated
  using (public.is_cafe_owner(id) or public.is_admin())
  with check (public.is_cafe_owner(id) or public.is_admin());

create policy branches_select on public.branches for select to authenticated
  using (public.is_cafe_member(cafe_id) or public.is_admin());
create policy branches_insert on public.branches for insert to authenticated
  with check (public.is_cafe_owner(cafe_id));
create policy branches_update on public.branches for update to authenticated
  using (public.is_cafe_owner(cafe_id)) with check (public.is_cafe_owner(cafe_id));

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_cafe_owner(cafe_id) or public.is_admin());

create policy campaigns_select on public.campaigns for select to authenticated
  using (public.is_cafe_member(cafe_id) or public.is_admin());

create policy progress_select on public.user_cafe_progress for select to authenticated
  using (user_id = auth.uid());

create policy stamps_select on public.stamp_events for select to authenticated
  using (user_id = auth.uid() or public.is_cafe_owner(cafe_id) or public.is_admin());

create policy rewards_select on public.rewards for select to authenticated
  using (user_id = auth.uid() or public.is_cafe_owner(cafe_id) or public.is_admin());

create policy redemptions_select on public.redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_cafe_owner(cafe_id) or public.is_admin());

create policy push_select on public.push_campaigns for select to authenticated
  using (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy push_insert on public.push_campaigns for insert to authenticated
  with check (public.is_cafe_owner(cafe_id) and status = 'draft');
create policy push_update on public.push_campaigns for update to authenticated
  using (public.is_cafe_owner(cafe_id) and status = 'draft')
  with check (public.is_cafe_owner(cafe_id));
create policy push_delete on public.push_campaigns for delete to authenticated
  using (public.is_cafe_owner(cafe_id) and status = 'draft');

create policy mutes_select on public.notification_mutes for select to authenticated
  using (user_id = auth.uid());
create policy mutes_insert on public.notification_mutes for insert to authenticated
  with check (user_id = auth.uid());
create policy mutes_delete on public.notification_mutes for delete to authenticated
  using (user_id = auth.uid());

create policy pricing_select on public.pricing for select to authenticated using (true);

create policy subs_select on public.subscriptions for select to authenticated
  using (public.is_cafe_owner(cafe_id) or public.is_admin());

create policy payments_select on public.payment_reports for select to authenticated
  using (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy payments_insert on public.payment_reports for insert to authenticated
  with check (public.is_cafe_owner(cafe_id) and reported_by = auth.uid() and status = 'pending');

create policy audit_select on public.audit_log for select to authenticated
  using (public.is_cafe_owner(cafe_id) or public.is_admin());

-- step_up_challenges, push_deliveries, otp_log: no policies (service role only).

-- -----------------------------------------------------------------------------
-- Function privileges: business logic is service-role only.
-- -----------------------------------------------------------------------------

revoke execute on function public.process_stamp(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean) from public;
revoke execute on function public.process_redemption(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean) from public;
revoke execute on function public.expire_rewards() from public;
revoke execute on function public.barista_membership(uuid, uuid, uuid, timestamptz) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.process_stamp(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean) to service_role;
    grant execute on function public.process_redemption(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean) to service_role;
    grant execute on function public.expire_rewards() to service_role;
    grant execute on function public.barista_membership(uuid, uuid, uuid, timestamptz) to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.process_stamp(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean) from anon, authenticated;
    revoke execute on function public.process_redemption(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean) from anon, authenticated;
    revoke execute on function public.expire_rewards() from anon, authenticated;
    revoke execute on function public.barista_membership(uuid, uuid, uuid, timestamptz) from anon, authenticated;
  end if;
end $$;

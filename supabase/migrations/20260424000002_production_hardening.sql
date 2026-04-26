-- ============================================================================
-- Brewistan production hardening
-- Adds SaaS subscription state, staff invitations, reward redemption workflow,
-- stronger abuse controls, QR counters, and auditable operational events.
-- Safe to run after 20260424000000_init.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enum extensions
-- --------------------------------------------------------------------------
alter type stamp_request_status add value if not exists 'cancelled';

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE redemption_status AS ENUM ('available', 'redeemed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app_event_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------
-- SaaS subscription/account state
-- --------------------------------------------------------------------------
alter table public.cafes
  add column if not exists subscription_status subscription_status not null default 'trialing',
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists blocked_reason text,
  add column if not exists onboarding_completed_at timestamptz;

create index if not exists cafes_subscription_status_idx on public.cafes(subscription_status);
create unique index if not exists cafes_stripe_customer_uidx on public.cafes(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists cafes_stripe_subscription_uidx on public.cafes(stripe_subscription_id) where stripe_subscription_id is not null;

-- --------------------------------------------------------------------------
-- Staff invitations; owner can invite before the staff member has an account.
-- --------------------------------------------------------------------------
create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  invited_email citext not null,
  role user_role not null check (role in ('branch_manager', 'barista')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status invitation_status not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (cafe_id, invited_email, status)
);

create index if not exists staff_invites_cafe_idx on public.staff_invitations(cafe_id);
create index if not exists staff_invites_email_idx on public.staff_invitations(invited_email);
create index if not exists staff_invites_token_idx on public.staff_invitations(token);

-- --------------------------------------------------------------------------
-- Reward redemption: earn reward separately, redeem with staff confirmation.
-- --------------------------------------------------------------------------
create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.loyalty_cards(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  status redemption_status not null default 'available',
  reward_text text not null,
  earned_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz default (now() + interval '90 days'),
  redemption_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,10))
);

create index if not exists redemption_cafe_status_idx on public.reward_redemptions(cafe_id, status);
create index if not exists redemption_customer_idx on public.reward_redemptions(customer_id, status);

-- --------------------------------------------------------------------------
-- Operational/fraud events
-- --------------------------------------------------------------------------
create table if not exists public.app_events (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  cafe_id uuid references public.cafes(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  event_name text not null,
  severity app_event_severity not null default 'info',
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_cafe_idx on public.app_events(cafe_id, created_at desc);
create index if not exists app_events_actor_idx on public.app_events(actor_id, created_at desc);

-- Strengthen stamp requests without breaking existing flows.
alter table public.stamp_requests
  add column if not exists device_fingerprint text,
  add column if not exists qr_nonce text,
  add column if not exists order_amount numeric(12,2),
  add column if not exists risk_score int not null default 0 check (risk_score between 0 and 100),
  add column if not exists risk_reason text;

-- --------------------------------------------------------------------------
-- Helper: cafe account must be usable before staff/customer operations.
-- --------------------------------------------------------------------------
create or replace function public.cafe_can_operate(p_cafe_id uuid)
returns boolean
security definer
set search_path = public
language sql stable as $$
  select exists (
    select 1 from public.cafes
    where id = p_cafe_id
      and is_active = true
      and subscription_status in ('trialing', 'active')
      and (subscription_status <> 'trialing' or trial_ends_at > now())
  );
$$;

grant execute on function public.cafe_can_operate to authenticated;

-- --------------------------------------------------------------------------
-- Staff invitation RPCs
-- --------------------------------------------------------------------------
create or replace function public.invite_staff_member(
  p_cafe_id uuid,
  p_email text,
  p_role user_role,
  p_branch_id uuid default null
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_invite public.staff_invitations%rowtype;
  v_email citext := lower(trim(p_email))::citext;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.is_cafe_owner(p_cafe_id) then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  if p_role not in ('barista','branch_manager') then raise exception 'INVALID_ROLE' using errcode='22023'; end if;
  if v_email::text !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'INVALID_EMAIL' using errcode='22023'; end if;

  insert into public.staff_invitations (cafe_id, branch_id, invited_email, role, invited_by)
  values (p_cafe_id, p_branch_id, v_email, p_role, auth.uid())
  on conflict (cafe_id, invited_email, status)
  do update set role = excluded.role, branch_id = excluded.branch_id, expires_at = now() + interval '7 days', token = encode(gen_random_bytes(24), 'hex')
  returning * into v_invite;

  insert into public.audit_log(actor_id, cafe_id, action, target_type, target_id, metadata)
  values(auth.uid(), p_cafe_id, 'staff.invited', 'staff_invitation', v_invite.id::text, jsonb_build_object('email', v_email, 'role', p_role));

  return jsonb_build_object('id', v_invite.id, 'email', v_invite.invited_email, 'token', v_invite.token, 'expires_at', v_invite.expires_at);
end;
$$;

create or replace function public.accept_staff_invitation(p_token text)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_invite public.staff_invitations%rowtype;
  v_email citext;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select email into v_email from public.profiles where id = auth.uid();

  select * into v_invite
  from public.staff_invitations
  where token = p_token and status = 'pending' and expires_at > now()
  for update;

  if v_invite.id is null then raise exception 'INVITATION_NOT_FOUND_OR_EXPIRED' using errcode='P0002'; end if;
  if lower(v_invite.invited_email::text) <> lower(v_email::text) then raise exception 'EMAIL_MISMATCH' using errcode='42501'; end if;

  insert into public.staff(cafe_id, branch_id, profile_id, role)
  values(v_invite.cafe_id, v_invite.branch_id, auth.uid(), v_invite.role)
  on conflict (cafe_id, profile_id) do update set role = excluded.role, branch_id = excluded.branch_id, is_active = true;

  update public.staff_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;

  update public.profiles set role = v_invite.role where id = auth.uid() and role = 'customer';

  insert into public.audit_log(actor_id, cafe_id, action, target_type, target_id)
  values(auth.uid(), v_invite.cafe_id, 'staff.invitation.accepted', 'staff_invitation', v_invite.id::text);
end;
$$;

grant execute on function public.invite_staff_member to authenticated;
grant execute on function public.accept_staff_invitation to authenticated;

-- --------------------------------------------------------------------------
-- Replace approve_stamp with reward redemption creation.
-- --------------------------------------------------------------------------
create or replace function public.approve_stamp(p_request_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_req public.stamp_requests%rowtype;
  v_card public.loyalty_cards%rowtype;
  v_campaign public.campaigns%rowtype;
  v_reward_issued boolean := false;
  v_redemption_id uuid;
  v_staff_id uuid := auth.uid();
begin
  if v_staff_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into v_req from public.stamp_requests where id = p_request_id for update;
  if v_req.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.cafe_can_operate(v_req.cafe_id) then raise exception 'CAFE_ACCOUNT_NOT_ACTIVE' using errcode='42501'; end if;
  if not public.is_cafe_staff(v_req.cafe_id) then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if v_req.status <> 'pending' then raise exception 'ALREADY_RESOLVED' using errcode = '22023'; end if;

  if v_req.expires_at <= now() then
    update public.stamp_requests set status = 'expired', resolved_at = now() where id = p_request_id;
    raise exception 'REQUEST_EXPIRED' using errcode = '22023';
  end if;

  select * into v_card from public.loyalty_cards where id = v_req.card_id for update;
  select * into v_campaign from public.campaigns where id = v_card.campaign_id;

  update public.loyalty_cards set stamps_count = stamps_count + 1 where id = v_card.id;

  if (v_card.stamps_count + 1) >= v_campaign.stamps_required then
    update public.loyalty_cards set stamps_count = 0, rewards_earned = rewards_earned + 1 where id = v_card.id;
    insert into public.reward_redemptions(card_id, cafe_id, campaign_id, customer_id, branch_id, reward_text)
    values(v_card.id, v_card.cafe_id, v_card.campaign_id, v_card.customer_id, v_req.branch_id, v_campaign.reward_text)
    returning id into v_redemption_id;
    v_reward_issued := true;
  end if;

  update public.stamp_requests set status = 'approved', resolved_at = now(), resolved_by = v_staff_id where id = p_request_id;

  insert into public.audit_log (actor_id, cafe_id, action, target_type, target_id, metadata)
  values (v_staff_id, v_req.cafe_id, 'stamp.approved', 'stamp_request', p_request_id::text,
          jsonb_build_object('card_id', v_card.id, 'reward_issued', v_reward_issued, 'redemption_id', v_redemption_id));

  return jsonb_build_object('approved', true, 'reward_issued', v_reward_issued, 'redemption_id', v_redemption_id);
end;
$$;

create or replace function public.redeem_reward(p_redemption_id uuid, p_branch_id uuid default null)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_red public.reward_redemptions%rowtype;
  v_staff_id uuid := auth.uid();
begin
  if v_staff_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_red from public.reward_redemptions where id = p_redemption_id for update;
  if v_red.id is null then raise exception 'REWARD_NOT_FOUND' using errcode='P0002'; end if;
  if not public.is_cafe_staff(v_red.cafe_id) then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  if v_red.status <> 'available' then raise exception 'REWARD_NOT_AVAILABLE' using errcode='22023'; end if;
  if v_red.expires_at is not null and v_red.expires_at <= now() then
    update public.reward_redemptions set status = 'expired' where id = p_redemption_id;
    raise exception 'REWARD_EXPIRED' using errcode='22023';
  end if;

  update public.reward_redemptions
  set status='redeemed', redeemed_at=now(), redeemed_by=v_staff_id, branch_id=coalesce(p_branch_id, branch_id)
  where id = p_redemption_id;

  insert into public.audit_log(actor_id, cafe_id, action, target_type, target_id)
  values(v_staff_id, v_red.cafe_id, 'reward.redeemed', 'reward_redemption', p_redemption_id::text);
end;
$$;

grant execute on function public.approve_stamp to authenticated;
grant execute on function public.redeem_reward to authenticated;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table public.staff_invitations enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.app_events enable row level security;

drop policy if exists staff_invites_owner_read on public.staff_invitations;
create policy staff_invites_owner_read
  on public.staff_invitations for select
  using (public.is_cafe_owner(cafe_id) or lower(invited_email::text) = lower((select email::text from public.profiles where id = auth.uid())));

drop policy if exists staff_invites_owner_update on public.staff_invitations;
create policy staff_invites_owner_update
  on public.staff_invitations for update
  using (public.is_cafe_owner(cafe_id))
  with check (public.is_cafe_owner(cafe_id));

drop policy if exists redemptions_select_involved on public.reward_redemptions;
create policy redemptions_select_involved
  on public.reward_redemptions for select
  using (customer_id = auth.uid() or public.is_cafe_staff(cafe_id));

drop policy if exists app_events_owner_read on public.app_events;
create policy app_events_owner_read
  on public.app_events for select
  using (cafe_id is not null and public.is_cafe_owner(cafe_id));

alter publication supabase_realtime add table public.reward_redemptions;

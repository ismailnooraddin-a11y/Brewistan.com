-- ============================================================================
-- Brewistan Phase 2: core workflow completion
--   - Soft-delete for campaigns (preserves customer loyalty card history)
--   - Loosen cascade on loyalty_cards.campaign_id (SET NULL, not DELETE)
--   - RLS / RPC updates to ignore soft-deleted campaigns
--   - Index on staff.profile_id for fast role lookup
--   - get_my_active_redemptions: customer-facing redemption listing helper
--   - get_pending_redemptions: staff-facing redemption queue helper
-- Safe to run after 20260424000002_production_hardening.sql.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Soft-delete column on campaigns
-- --------------------------------------------------------------------------
alter table public.campaigns
  add column if not exists deleted_at timestamptz;

create index if not exists campaigns_active_idx
  on public.campaigns(cafe_id, status)
  where deleted_at is null;

-- --------------------------------------------------------------------------
-- 2. Loosen cascade: deleting a campaign should NOT wipe loyalty card history
-- --------------------------------------------------------------------------
do $$
declare
  v_constraint_name text;
begin
  select tc.constraint_name into v_constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_schema = 'public'
    and tc.table_name = 'loyalty_cards'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'campaign_id';

  if v_constraint_name is not null then
    execute format('alter table public.loyalty_cards drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.loyalty_cards
  alter column campaign_id drop not null;

alter table public.loyalty_cards
  add constraint loyalty_cards_campaign_id_fkey
  foreign key (campaign_id) references public.campaigns(id)
  on delete set null;

-- --------------------------------------------------------------------------
-- 3. Staff lookup index (used on every staff page load)
-- --------------------------------------------------------------------------
create index if not exists staff_profile_active_idx
  on public.staff(profile_id, is_active)
  where is_active = true;

-- --------------------------------------------------------------------------
-- 4. Update RLS: customers should not see soft-deleted campaigns
--    (Owners can still see them via the dashboard with a separate query.)
-- --------------------------------------------------------------------------
drop policy if exists campaigns_select_active_or_staff on public.campaigns;
create policy campaigns_select_active_or_staff
  on public.campaigns for select
  using (
    (status = 'active' and deleted_at is null)
    or public.is_cafe_staff(cafe_id)
  );

-- --------------------------------------------------------------------------
-- 5. request_stamp: skip soft-deleted campaigns when finding the active one
-- --------------------------------------------------------------------------
create or replace function public.request_stamp(
  p_cafe_slug text,
  p_branch_id uuid default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_cafe_id uuid;
  v_campaign_id uuid;
  v_card_id uuid;
  v_request_id uuid;
  v_existing uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select id into v_cafe_id
  from public.cafes
  where slug = lower(p_cafe_slug) and is_active = true;
  if v_cafe_id is null then
    raise exception 'CAFE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.cafe_can_operate(v_cafe_id) then
    raise exception 'CAFE_ACCOUNT_NOT_ACTIVE' using errcode = '42501';
  end if;

  select id into v_campaign_id
  from public.campaigns
  where cafe_id = v_cafe_id
    and status = 'active'
    and deleted_at is null
  order by starts_at desc
  limit 1;
  if v_campaign_id is null then
    raise exception 'NO_ACTIVE_CAMPAIGN' using errcode = 'P0002';
  end if;

  -- Upsert loyalty card (one per customer × campaign)
  insert into public.loyalty_cards (customer_id, cafe_id, campaign_id)
  values (v_uid, v_cafe_id, v_campaign_id)
  on conflict (customer_id, campaign_id) do update set updated_at = now()
  returning id into v_card_id;

  -- Reuse pending request if one already exists
  select id into v_existing
  from public.stamp_requests
  where card_id = v_card_id and status = 'pending' and expires_at > now()
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.stamp_requests (card_id, cafe_id, branch_id, customer_id)
  values (v_card_id, v_cafe_id, p_branch_id, v_uid)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.request_stamp to authenticated;

-- --------------------------------------------------------------------------
-- 6. Customer redemption helpers
-- --------------------------------------------------------------------------
create or replace function public.get_my_active_redemptions()
returns setof public.reward_redemptions
security definer
set search_path = public
language sql stable as $$
  select * from public.reward_redemptions
  where customer_id = auth.uid()
    and status = 'available'
    and (expires_at is null or expires_at > now())
  order by earned_at desc;
$$;

grant execute on function public.get_my_active_redemptions to authenticated;

-- --------------------------------------------------------------------------
-- 7. Staff redemption queue (available + recently redeemed)
-- --------------------------------------------------------------------------
create or replace function public.get_cafe_pending_redemptions(p_cafe_id uuid)
returns setof public.reward_redemptions
security definer
set search_path = public
language plpgsql stable as $$
begin
  if not public.is_cafe_staff(p_cafe_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return query
  select * from public.reward_redemptions
  where cafe_id = p_cafe_id
    and status = 'available'
    and (expires_at is null or expires_at > now())
  order by earned_at asc;
end;
$$;

grant execute on function public.get_cafe_pending_redemptions to authenticated;

-- --------------------------------------------------------------------------
-- 8. Realtime: ensure reward_redemptions stays in the publication
-- --------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.reward_redemptions;
exception when duplicate_object then null;
end $$;

-- --------------------------------------------------------------------------
-- 9. Audit logging hook for soft-deletes (purely informational)
-- --------------------------------------------------------------------------
create or replace function public.tg_campaign_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.audit_log(actor_id, cafe_id, action, target_type, target_id, metadata)
    values(auth.uid(), new.cafe_id, 'campaign.soft_deleted', 'campaign', new.id::text,
           jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

drop trigger if exists tr_campaign_soft_delete on public.campaigns;
create trigger tr_campaign_soft_delete
  after update of deleted_at on public.campaigns
  for each row execute function public.tg_campaign_soft_delete();

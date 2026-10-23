-- Preserve historical campaign requirements for offline first stamps.
-- Based on effective process_stamp from migration 07; changing it requires
-- maintaining idempotency, cooldown, payment and membership safeguards.
-- Late out-of-order events are quarantined for review rather than re-awarded.

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
  if p_event_id is null or p_scanned_at is null or p_offline is null then
    raise exception 'invalid_event' using errcode='22023';
  end if;
  -- Same id serializes even before there is a progress row. Shared namespace with redemptions.
  perform pg_advisory_xact_lock(hashtextextended('event:' || p_event_id::text, 0));
  if exists(select 1 from public.redemptions where id=p_event_id) then
    raise exception 'event_type_conflict' using errcode='22023';
  end if;
  -- Idempotency: the same event id always returns its first result.
  select * into v_existing from public.stamp_events where id = p_event_id;
  if found then
    if v_existing.user_id is distinct from p_user_id or v_existing.cafe_id <> p_cafe_id
       or v_existing.staff_id is distinct from p_staff_id or v_existing.branch_id is distinct from p_branch_id then
      raise exception 'event_conflict' using errcode='22023';
    end if;
    return jsonb_build_object('status', v_existing.status, 'reason', v_existing.reason, 'duplicate', true);
  end if;

  if p_scanned_at > now() + interval '5 minutes' or p_scanned_at < now() - interval '7 days' then
    return jsonb_build_object('status','rejected','reason','invalid_time');
  end if;
  select * into v_cafe from public.cafes where id = p_cafe_id;
  if not found then
    raise exception 'cafe_not_found';
  end if;
  if v_cafe.status <> 'active' then
    v_status := 'rejected'; v_reason := 'cafe_inactive';
  end if;

  if v_status = 'accepted' and (p_branch_id is null or not exists (select 1 from public.branches where id = p_branch_id and cafe_id = p_cafe_id and active)) then
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
    elsif v_member.status <> 'active' then
      v_status := case when p_offline then 'quarantined'::public.event_status else 'rejected'::public.event_status end;
      v_reason := 'staff_revoked_before_sync';
    end if;
  end if;

  if v_status = 'accepted' and p_user_id = p_staff_id then
    v_status := 'rejected'; v_reason := 'self_scan';
  end if;

  if v_status = 'accepted' and exists (select 1 from public.memberships
                                       where cafe_id = p_cafe_id and user_id = p_user_id and status = 'active') then
    v_status := 'rejected'; v_reason := 'staff_account';
  end if;

  if v_status = 'accepted' and not (case when p_offline then public.cafe_can_earn_at(p_cafe_id,p_scanned_at) else public.cafe_can_earn(p_cafe_id) end) then
    v_status := 'rejected'; v_reason := 'subscription_inactive';
  end if;
  -- A first stamp recorded offline must use the campaign that existed WHEN
  -- it was scanned, not the campaign that happens to be active on sync day.
  if p_offline then
    select * into v_campaign from public.campaigns
      where cafe_id = p_cafe_id and created_at <= p_scanned_at
      order by created_at desc, version desc limit 1;
  else
    select * into v_campaign from public.campaigns where cafe_id = p_cafe_id and active;
  end if;
  if v_status = 'accepted' and not found then
    v_status := 'rejected'; v_reason := 'no_campaign';
  end if;

  if v_status = 'accepted' then
    insert into public.user_cafe_progress (user_id, cafe_id) values (p_user_id, p_cafe_id)
    on conflict do nothing;
    -- Row lock serialises concurrent scans of the same customer at the same cafe.
    select * into v_progress from public.user_cafe_progress
     where user_id = p_user_id and cafe_id = p_cafe_id for update;
    if p_offline and v_progress.last_stamp_at is not null and p_scanned_at < v_progress.last_stamp_at then
      v_status := 'quarantined'; v_reason := 'out_of_order_offline';
    end if;
    -- Keep the terms of a puzzle already started. A new campaign applies to the next puzzle.
    if v_progress.stamps_in_current > 0 and v_progress.campaign_id is not null then
      select * into v_campaign from public.campaigns where id=v_progress.campaign_id;
    end if;

    if v_status = 'accepted' and exists (
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
         campaign_id = case when v_completed then null else v_campaign.id end,
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

-- Audit hardening. Apply after the original migrations; do not edit deployed history.
-- Back up production, then apply in staging first. See docs/UPGRADE.md.

alter table public.user_cafe_progress add column if not exists campaign_id uuid references public.campaigns(id);
update public.user_cafe_progress p set campaign_id = c.id from public.campaigns c
 where p.cafe_id = c.cafe_id and c.active and p.stamps_in_current > 0 and p.campaign_id is null;
alter table public.redemptions add column if not exists scanner_device_id uuid;
create index if not exists redemptions_scanner_day_idx on public.redemptions(scanner_device_id, redeemed_at) where offline and status = 'accepted';

create or replace function public.is_privileged() returns boolean
language sql stable security definer set search_path = public as $$
 select public.is_admin() or coalesce(auth.jwt()->>'role', '') = 'service_role'
 or (coalesce(nullif(current_setting('role', true), 'none'), '') = ''
     and session_user in ('postgres', 'supabase_admin'));
$$;

-- Identity-based invitations must never activate from an unverified phone.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_privileged() then
    new.phone := (select case when phone_confirmed_at is not null then regexp_replace(phone,'[^0-9]','','g') else null end from auth.users where id=old.id);
    new.deleted_at := old.deleted_at;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(id, phone) values(new.id,
   case when new.phone_confirmed_at is not null then nullif(public.normalize_phone(new.phone), '') end)
 on conflict(id) do nothing;
 update public.profiles set phone = case when new.phone_confirmed_at is not null then nullif(public.normalize_phone(new.phone),'') end where id = new.id;
 if new.phone_confirmed_at is not null and coalesce(new.phone, '') <> '' then
   update public.memberships set user_id = new.id, status = 'active', activated_at = now()
    where phone = public.normalize_phone(new.phone) and status = 'invited' and user_id is null;
 end if;
 return new;
end $$;
drop trigger if exists on_auth_phone_verified on auth.users;
create trigger on_auth_phone_verified after update of phone, phone_confirmed_at on auth.users
 for each row execute function public.handle_new_user();

-- Reconcile legacy invitations that were activated before phone verification.
update public.memberships m set status = 'invited', user_id = null, activated_at = null
 from auth.users u where m.user_id = u.id and m.role = 'barista'
 and m.status = 'active' and u.phone_confirmed_at is null;

create or replace function public.cafe_can_earn(p_cafe uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.cafes c join public.subscriptions s on s.cafe_id=c.id
  where c.id=p_cafe and c.status='active' and
  ((s.status='trial' and s.trial_ends_at > now()) or (s.status='active' and s.current_period_end > now())));
$$;

create or replace function public.barista_membership(p_cafe uuid, p_staff uuid, p_branch uuid, p_at timestamptz)
returns setof public.memberships
language sql stable security definer set search_path = public as $$
 select m.* from public.memberships m
 where m.cafe_id=p_cafe and m.user_id=p_staff and m.role='barista'
 and m.status in ('active','revoked') and m.activated_at <= p_at
 and (m.revoked_at is null or m.revoked_at > p_at)
 and (m.branch_id is null or m.branch_id=p_branch)
 order by m.activated_at desc limit 1;
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

  if v_status = 'accepted' and not public.cafe_can_earn(p_cafe_id) then
    v_status := 'rejected'; v_reason := 'subscription_inactive';
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
    -- Keep the terms of a puzzle already started. A new campaign applies to the next puzzle.
    if v_progress.stamps_in_current > 0 and v_progress.campaign_id is not null then
      select * into v_campaign from public.campaigns where id=v_progress.campaign_id;
    end if;

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
  if p_redemption_id is null or p_redeemed_at is null or p_offline is null then
    raise exception 'invalid_event' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('event:' || p_redemption_id::text, 0));
  if exists(select 1 from public.stamp_events where id=p_redemption_id) then
    raise exception 'event_type_conflict' using errcode='22023';
  end if;
  select * into v_existing from public.redemptions where id = p_redemption_id;
  if found then
    if v_existing.user_id is distinct from p_user_id or v_existing.cafe_id <> p_cafe_id
       or v_existing.staff_id is distinct from p_staff_id or v_existing.branch_id is distinct from p_branch_id then
      raise exception 'event_conflict' using errcode='22023';
    end if;
    return jsonb_build_object('status', v_existing.status, 'reason', v_existing.reason, 'duplicate', true);
  end if;

  if p_redeemed_at > now() + interval '5 minutes' or p_redeemed_at < now() - interval '7 days' then
    return jsonb_build_object('status','rejected','reason','invalid_time');
  end if;
  if p_offline and p_reward_id is null then
    return jsonb_build_object('status','rejected','reason','voucher_required');
  end if;
  select * into v_cafe from public.cafes where id = p_cafe_id;
  if not found then
    raise exception 'cafe_not_found';
  end if;
  if v_cafe.status <> 'active' then
    v_status := 'rejected'; v_reason := 'cafe_inactive';
  end if;

  if v_status = 'accepted' and (p_branch_id is null or not exists(
      select 1 from public.branches where id=p_branch_id and cafe_id=p_cafe_id and active)) then
    v_status := 'rejected'; v_reason := 'branch_mismatch';
  end if;
  if v_status = 'accepted' then
    select * into v_member from public.barista_membership(p_cafe_id, p_staff_id, p_branch_id, p_redeemed_at);
    if not found then
      v_status := 'rejected'; v_reason := 'not_staff';
    elsif v_member.status <> 'active' then
      v_status := 'rejected'; v_reason := 'staff_revoked_before_sync';
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
       where user_id = p_user_id and cafe_id = p_cafe_id and status = 'available' and expires_at > p_redeemed_at and issued_at <= p_redeemed_at
       order by issued_at limit 1 for update;
    end if;

    if not found then
      v_status := 'rejected'; v_reason := 'no_reward';
    elsif v_reward.issued_at > p_redeemed_at then
      v_status := 'rejected'; v_reason := 'reward_not_issued';
    elsif v_reward.expires_at <= p_redeemed_at then
      v_status := 'rejected'; v_reason := 'reward_expired';
    elsif v_reward.status <> 'available' and not (p_offline and v_reward.status = 'expired') then
      v_status := case when p_offline and v_reward.status = 'redeemed' then 'duplicate'::public.redemption_status else 'rejected'::public.redemption_status end;
      v_reason := 'reward_' || v_reward.status::text;
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


-- Offline allowance is enforced centrally per scanner install and Baghdad day.
create or replace function public.process_redemption_secure(
 p_redemption_id uuid, p_reward_id uuid, p_user_id uuid, p_cafe_id uuid,
 p_branch_id uuid, p_staff_id uuid, p_redeemed_at timestamptz, p_offline boolean, p_scanner_device_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_day date; v_count int;
begin
 if p_redemption_id is null or p_redeemed_at is null or p_offline is null then raise exception 'invalid_event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('event:' || p_redemption_id::text,0));
 if exists(select 1 from public.stamp_events where id=p_redemption_id) then raise exception 'event_type_conflict' using errcode='22023'; end if;
 if p_offline and not exists(select 1 from public.redemptions where id=p_redemption_id) then
   if p_scanner_device_id is null or not exists(select 1 from public.devices
       where id=p_scanner_device_id and user_id=p_staff_id and revoked_at is null) then
     raise exception 'scanner_device_invalid' using errcode='22023';
   end if;
   v_day := (p_redeemed_at at time zone 'Asia/Baghdad')::date;
   perform pg_advisory_xact_lock(hashtextextended('offline:' || p_scanner_device_id::text || ':' || v_day::text,0));
   select count(*) into v_count from public.redemptions where scanner_device_id=p_scanner_device_id
     and offline and status='accepted' and (redeemed_at at time zone 'Asia/Baghdad')::date=v_day;
   if v_count >= 2 then
     insert into public.redemptions(id,reward_id,user_id,cafe_id,branch_id,staff_id,redeemed_at,offline,status,reason,scanner_device_id)
       values(p_redemption_id,null,p_user_id,p_cafe_id,p_branch_id,p_staff_id,p_redeemed_at,true,'rejected','offline_cap',p_scanner_device_id);
     return jsonb_build_object('status','rejected','reason','offline_cap');
   end if;
 end if;
 v_result := public.process_redemption(p_redemption_id,p_reward_id,p_user_id,p_cafe_id,p_branch_id,p_staff_id,p_redeemed_at,p_offline);
 update public.redemptions set scanner_device_id=coalesce(scanner_device_id,p_scanner_device_id) where id=p_redemption_id;
 return v_result;
end $$;
revoke all on function public.process_redemption_secure(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,boolean,uuid) from public,anon,authenticated;
grant execute on function public.process_redemption_secure(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,boolean,uuid) to service_role;


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
  perform 1 from public.cafes where id=p_cafe for update;
  if jsonb_typeof(p_reward_label) <> 'object' or char_length(trim(coalesce(p_reward_label->>'en',''))) not between 1 and 40 then
    raise exception 'invalid_reward_label' using errcode='22023';
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

create or replace function public.cafes_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then
    update public.user_cafe_progress set archived = true where cafe_id = new.id;
  end if;
  if new.status = 'active' and old.status in ('pending', 'rejected') then
    update public.subscriptions
       set trial_ends_at = case when status = 'trial' and trial_ends_at is null then now() + interval '14 days' else trial_ends_at end
     where cafe_id = new.id;
  end if;
  return new;
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
             where r.user_id = p.user_id and r.cafe_id = p.cafe_id and r.status = 'available' and r.expires_at > now()),
           p.last_stamp_at, p.archived
    from public.user_cafe_progress p
    join public.profiles pr on pr.id = p.user_id
    where p.cafe_id = p_cafe
    order by p.last_stamp_at desc nulls last;
end $$;

create or replace function public.admin_review_payment(p_report uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.payment_reports%rowtype;
  v_price int;
begin
  if not public.is_admin() then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
  select * into v from public.payment_reports where id = p_report and status = 'pending' for update;
  if not found then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  if p_approve then
    select p.monthly_iqd into v_price from public.subscriptions s join public.pricing p on p.tier=s.tier
      where s.cafe_id=v.cafe_id;
    if v_price is null or v.amount_iqd < v_price * v.months then
      raise exception 'payment_below_required_amount' using errcode='22023';
    end if;
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


-- Guard same-tenant relations even when both tenants have the same owner.
create or replace function public.branch_identity_guard() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.cafe_id <> old.cafe_id or new.id <> old.id then raise exception 'branch_identity_immutable' using errcode='22023'; end if;
 return new;
end $$;
create trigger branch_identity_guard before update on public.branches for each row execute function public.branch_identity_guard();
create or replace function public.membership_branch_guard() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.branch_id is not null and not exists(select 1 from public.branches where id=new.branch_id and cafe_id=new.cafe_id) then
   raise exception 'branch_mismatch' using errcode='22023';
 end if;
 return new;
end $$;
create trigger membership_branch_guard before insert or update on public.memberships for each row execute function public.membership_branch_guard();

create or replace function public.cafes_content_guard() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and not public.is_privileged() then new.brand := '{}'::jsonb; new.logo_path := null; end if;
 if new.logo_path is not null and split_part(new.logo_path,'/',1) <> new.id::text then
   raise exception 'logo_tenant_mismatch' using errcode='22023';
 end if;
 if new.verification_photo_path is not null and split_part(new.verification_photo_path,'/',1) <> new.id::text then
   raise exception 'verification_tenant_mismatch' using errcode='22023';
 end if;
 if jsonb_typeof(new.brand) <> 'object' or (new.brand ? 'template' and new.brand->>'template' not in ('noir','espresso','marble','emerald')) then
   raise exception 'invalid_brand' using errcode='22023';
 end if;
 if (new.brand ? 'primary' and new.brand->>'primary' !~ '^#[0-9a-fA-F]{6}$') or
    (new.brand ? 'accent' and new.brand->>'accent' !~ '^#[0-9a-fA-F]{6}$') then
   raise exception 'invalid_brand_color' using errcode='22023';
 end if;
 return new;
end $$;
create trigger zz_cafes_content_guard before insert or update on public.cafes for each row execute function public.cafes_content_guard();

-- Pseudonymous reporting: do not expose customer UUIDs through owner SELECTs.
drop policy stamps_select on public.stamp_events;
create policy stamps_select on public.stamp_events for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy rewards_select on public.rewards;
create policy rewards_select on public.rewards for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy redemptions_select on public.redemptions;
create policy redemptions_select on public.redemptions for select to authenticated using(user_id=auth.uid() or public.is_admin());
create or replace function public.owner_activity(p_cafe uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then raise exception 'not_owner' using errcode='42501'; end if;
 return jsonb_build_object(
  'redemptions',(select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
    select id,redeemed_at,offline,status,reason,staff_id,void_reason,branch_id from public.redemptions
    where cafe_id=p_cafe order by redeemed_at desc limit 50) x),
  'issues',(select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
    select id,scanned_at,status,reason,flagged,offline,staff_id from public.stamp_events
    where cafe_id=p_cafe and (status <> 'accepted' or flagged) order by scanned_at desc limit 50) x));
end $$;
revoke all on function public.owner_activity(uuid) from public, anon;
grant execute on function public.owner_activity(uuid) to authenticated;

-- Provider-side upload restrictions; extensions supplied by browsers are not trusted.
update storage.buckets set file_size_limit=5000000, allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='verification';
update storage.buckets set file_size_limit=1000000, allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='branding';
create policy "branding owner read" on storage.objects for select to authenticated
 using(bucket_id='branding' and public.is_cafe_owner(public.path_cafe_id(name)));
drop policy "branding update by owner" on storage.objects;
create policy "branding update by owner" on storage.objects for update to authenticated
 using(bucket_id='branding' and public.is_cafe_owner(public.path_cafe_id(name)))
 with check(bucket_id='branding' and public.is_cafe_owner(public.path_cafe_id(name)));


-- Resolve a committed retry before rechecking live device/snapshot permissions.
-- Only Edge service credentials may call this; identity comes from verified auth.
create or replace function public.lookup_scan_event(p_id uuid,p_staff uuid,p_cafe uuid,p_branch uuid,p_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e record;
begin
 select * into e from (
   select id,user_id,cafe_id,branch_id,staff_id,status::text,reason,'stamp'::text as type from public.stamp_events where id=p_id
   union all
   select id,user_id,cafe_id,branch_id,staff_id,status::text,reason,'redeem'::text as type from public.redemptions where id=p_id
 ) x limit 1;
 if not found then return null; end if;
 if e.staff_id is distinct from p_staff or e.cafe_id is distinct from p_cafe or e.branch_id is distinct from p_branch or e.type <> p_type then
   raise exception 'event_conflict' using errcode='22023';
 end if;
 return jsonb_build_object('status',e.status,'reason',e.reason,'userId',e.user_id,'duplicate',true);
end $$;
revoke all on function public.lookup_scan_event(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.lookup_scan_event(uuid,uuid,uuid,uuid,text) to service_role;

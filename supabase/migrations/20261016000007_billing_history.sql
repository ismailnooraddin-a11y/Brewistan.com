-- Quote the price before money is reported; preserve observed entitlement periods.
create table public.subscription_entitlements (
 id uuid primary key default gen_random_uuid(), cafe_id uuid not null references public.cafes(id) on delete cascade,
 starts_at timestamptz not null, ends_at timestamptz not null, source text not null,
 recorded_at timestamptz not null default now(), revoked_at timestamptz, check(ends_at>starts_at)
);
create index subscription_entitlements_lookup on public.subscription_entitlements(cafe_id,starts_at,ends_at);
alter table public.subscription_entitlements enable row level security;
create policy entitlement_read on public.subscription_entitlements for select to authenticated
 using(public.is_cafe_owner(cafe_id) or public.is_admin());
-- Do not invent historical paid-service start times from one mutable end date.
insert into public.subscription_entitlements(cafe_id,starts_at,ends_at,source)
 select cafe_id,now(),case when status='trial' then trial_ends_at else current_period_end end,'migration_observed'
 from public.subscriptions where (status='trial' and trial_ends_at>now()) or (status='active' and current_period_end>now());
create function public.record_entitlement() returns trigger
language plpgsql security definer set search_path=public as $$
declare finish timestamptz; begin
 if tg_op='UPDATE' then
  update public.subscription_entitlements set revoked_at=now() where cafe_id=new.cafe_id and revoked_at is null and ends_at>now();
 end if;
 finish:=case when new.status='trial' then new.trial_ends_at when new.status='active' then new.current_period_end end;
 if finish>now() then
  insert into public.subscription_entitlements(cafe_id,starts_at,ends_at,source)
   values(new.cafe_id,now(),finish,'subscription_change');
 end if;
 return new;
end $$;
create trigger record_entitlement after insert or update of status,trial_ends_at,current_period_end on public.subscriptions
 for each row execute function public.record_entitlement();
create function public.cafe_can_earn_at(p_cafe uuid,p_at timestamptz) returns boolean
language sql stable security definer set search_path=public as $$
 select p_at<=now()+interval '1 minute' and p_at>=now()-interval '7 days'
 and exists(select 1 from public.cafes where id=p_cafe and status='active')
 and exists(select 1 from public.subscription_entitlements where cafe_id=p_cafe and starts_at<=p_at and ends_at>p_at and (revoked_at is null or revoked_at>p_at));
$$;
revoke all on function public.cafe_can_earn_at(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.cafe_can_earn_at(uuid,timestamptz) to service_role;

create table public.payment_quotes (
 id uuid primary key default gen_random_uuid(), cafe_id uuid not null references public.cafes(id) on delete cascade,
 created_by uuid references public.profiles(id) on delete set null,
 tier public.cafe_tier not null, months int not null check(months between 1 and 12),
 monthly_iqd int not null check(monthly_iqd>=0), required_iqd int not null check(required_iqd>0),
 reason text, expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now(), used_at timestamptz
);
alter table public.payment_quotes enable row level security;
create policy payment_quote_read on public.payment_quotes for select to authenticated
 using(public.is_cafe_owner(cafe_id) or public.is_admin());
alter table public.payment_reports add column quote_id uuid unique references public.payment_quotes(id);
-- A client cannot mark its own payment confirmed or forge review metadata.
drop policy payments_insert on public.payment_reports;

create function public.create_payment_quote(p_cafe uuid,p_months int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.payment_quotes%rowtype; plan public.cafe_tier; price int;
begin
 if not public.is_cafe_owner(p_cafe) then raise exception 'not_owner' using errcode='42501'; end if;
 if p_months is null or p_months not in (1,3,6,12) then raise exception 'invalid_months' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('billing:'||p_cafe::text,0));
 select s.tier,p.monthly_iqd into plan,price from public.subscriptions s join public.pricing p on p.tier=s.tier where s.cafe_id=p_cafe;
 if price is null or price<=0 then raise exception 'pricing_not_configured' using errcode='22023'; end if;
 select * into q from public.payment_quotes where cafe_id=p_cafe and created_by=auth.uid() and tier=plan
  and months=p_months and monthly_iqd=price and reason is null and used_at is null and expires_at>now()+interval '5 minutes'
  order by created_at desc limit 1;
 if not found then
  insert into public.payment_quotes(cafe_id,created_by,tier,months,monthly_iqd,required_iqd)
   values(p_cafe,auth.uid(),plan,p_months,price,price*p_months) returning * into q;
 end if;
 return to_jsonb(q);
end $$;

create function public.submit_payment_report(p_quote uuid,p_method text,p_amount int,p_reference text) returns uuid
language plpgsql security definer set search_path=public as $$
declare q public.payment_quotes%rowtype; r public.payment_reports%rowtype; ref text;
begin
 select * into q from public.payment_quotes where id=p_quote for update;
 if not found or not public.is_cafe_owner(q.cafe_id) then raise exception 'not_owner' using errcode='42501'; end if;
 ref:=upper(regexp_replace(trim(coalesce(p_reference,'')),'\s+','','g'));
 if p_method is null or p_method not in ('zain_cash','fib','bank_transfer') or length(ref) not between 3 and 100
  or p_amount is null then raise exception 'invalid_payment' using errcode='22023'; end if;
 select * into r from public.payment_reports where quote_id=q.id;
 if found then
  if r.method=p_method and r.amount_iqd=p_amount and r.reference=ref then return r.id; end if;
  raise exception 'quote_already_used' using errcode='22023';
 end if;
 if q.expires_at<=now() or q.used_at is not null then raise exception 'quote_expired' using errcode='22023'; end if;
 if p_amount<>q.required_iqd then raise exception 'payment_must_match_quote' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payment-ref:'||p_method||':'||ref,0));
 if exists(select 1 from public.payment_reports where method=p_method
  and upper(regexp_replace(trim(reference),'\s+','','g'))=ref and status<>'rejected') then
  raise exception 'payment_reference_used' using errcode='22023';
 end if;
 insert into public.payment_reports(cafe_id,reported_by,method,amount_iqd,months,reference,quote_id)
 values(q.cafe_id,auth.uid(),p_method,p_amount,q.months,ref,q.id) returning * into r;
 update public.payment_quotes set used_at=now() where id=q.id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id,meta)
 values(q.cafe_id,auth.uid(),'payment_reported','payment_report',r.id::text,jsonb_build_object('quoteId',q.id));
 return r.id;
end $$;

-- Explicit support workflow for evidence-backed discounts/legacy promises. Never silently reprice.
create function public.admin_quote_payment(p_cafe uuid,p_months int,p_amount int,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare id uuid; plan public.cafe_tier; price int;
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 if p_months is null or p_months not between 1 and 12 or p_amount is null or p_amount<1 or length(trim(coalesce(p_reason,''))) not between 10 and 1000 then
  raise exception 'invalid_quote_or_reason' using errcode='22023'; end if;
 select s.tier,p.monthly_iqd into plan,price from public.subscriptions s join public.pricing p on p.tier=s.tier where s.cafe_id=p_cafe;
 if plan is null then raise exception 'cafe_not_found' using errcode='22023'; end if;
 insert into public.payment_quotes(cafe_id,created_by,tier,months,monthly_iqd,required_iqd,reason)
 values(p_cafe,auth.uid(),plan,p_months,price,p_amount,trim(p_reason)) returning payment_quotes.id into id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id,reason)
 values(p_cafe,auth.uid(),'custom_quote_created','payment_quote',id::text,trim(p_reason));
 return id;
end $$;
create function public.admin_reconcile_legacy_payment(p_report uuid,p_required int,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare r public.payment_reports%rowtype; q uuid;
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 select * into r from public.payment_reports where id=p_report for update;
 if not found or r.status<>'pending' or r.quote_id is not null or r.amount_iqd<>p_required then
  raise exception 'not_eligible_for_reconciliation' using errcode='22023'; end if;
 q:=public.admin_quote_payment(r.cafe_id,r.months,p_required,p_reason);
 update public.payment_reports set quote_id=q where id=p_report;
 update public.payment_quotes set used_at=now() where id=q;
end $$;

create or replace function public.admin_review_payment(p_report uuid,p_approve boolean) returns void
language plpgsql security definer set search_path=public as $$
declare r public.payment_reports%rowtype; q public.payment_quotes%rowtype; s public.subscriptions%rowtype;
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 if p_approve is null then raise exception 'decision_required' using errcode='22023'; end if;
 select * into r from public.payment_reports where id=p_report for update;
 if not found then raise exception 'payment_not_found' using errcode='22023'; end if;
 if r.status=(case when p_approve then 'confirmed' else 'rejected' end) then return; end if;
 if r.status<>'pending' then raise exception 'not_pending' using errcode='22023'; end if;
 if p_approve then
  perform pg_advisory_xact_lock(hashtextextended('payment-ref:'||r.method||':'||upper(regexp_replace(trim(r.reference),'\s+','','g')),0));
  if exists(select 1 from public.payment_reports other where other.id<>r.id and other.status='confirmed'
    and other.method=r.method and upper(regexp_replace(trim(other.reference),'\s+','','g'))=upper(regexp_replace(trim(r.reference),'\s+','','g'))) then
   raise exception 'payment_reference_used' using errcode='22023';
  end if;
  select * into q from public.payment_quotes where id=r.quote_id;
  if not found then raise exception 'legacy_quote_review_required' using errcode='22023'; end if;
  if r.amount_iqd<>q.required_iqd or r.months<>q.months or r.cafe_id<>q.cafe_id then raise exception 'quote_mismatch' using errcode='22023'; end if;
  select * into s from public.subscriptions where cafe_id=r.cafe_id for update;
  if not found or s.tier<>q.tier then raise exception 'plan_changed_review_required' using errcode='22023'; end if;
  update public.subscriptions set status='active',current_period_end=
   greatest(coalesce(s.current_period_end,now()),coalesce(s.trial_ends_at,now()),now())+make_interval(months=>r.months)
   where cafe_id=r.cafe_id;
 end if;
 update public.payment_reports set status=case when p_approve then 'confirmed' else 'rejected' end,
 reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id,meta)
 values(r.cafe_id,auth.uid(),case when p_approve then 'payment_confirmed' else 'payment_rejected' end,
 'payment_report',r.id::text,jsonb_build_object('quoteId',r.quote_id));
end $$;

-- Explicit server gate and grants for every new client RPC.
revoke all on function public.create_payment_quote(uuid,int),public.submit_payment_report(uuid,text,int,text),
 public.admin_quote_payment(uuid,int,int,text),public.admin_reconcile_legacy_payment(uuid,int,text) from public,anon;
grant execute on function public.create_payment_quote(uuid,int),public.submit_payment_report(uuid,text,int,text),
 public.admin_quote_payment(uuid,int,int,text),public.admin_reconcile_legacy_payment(uuid,int,text) to authenticated;

-- Preserve all original idempotency/cooldown/campaign rules.
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


create function public.admin_record_entitlement(p_cafe uuid,p_start timestamptz,p_end timestamptz,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare entitlement uuid;
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_end<=p_start or p_start>now() or
   length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception 'invalid_history_evidence' using errcode='22023'; end if;
 insert into public.subscription_entitlements(cafe_id,starts_at,ends_at,source)
  values(p_cafe,p_start,p_end,'verified_history') returning id into entitlement;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id,reason)
  values(p_cafe,auth.uid(),'entitlement_history_recorded','subscription_entitlement',entitlement::text,btrim(p_reason));
 return entitlement;
end $$;
revoke all on function public.admin_record_entitlement(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.admin_record_entitlement(uuid,timestamptz,timestamptz,text) to authenticated;

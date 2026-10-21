-- 1. Campaign limits per plan, per calendar month (Baghdad time):
--    Classic 0, Signature 1, Bespoke 5. Replaces the old "2 per week" rule.
--    The "one message per customer per day" rule is unchanged.
-- 2. owner_risk_report: a plain-language risk level per barista for the
--    Scan history page, built from clear, explainable checks.

create or replace function public.push_monthly_limit(p_tier text) returns int
language sql immutable as $$
  select case p_tier when 'bespoke' then 5 when 'signature' then 1 else 0 end;
$$;

-- Returns null when the cafe may approve another campaign for the month of p_at,
-- otherwise the reason: 'plan_no_campaigns' or 'monthly_limit'.
create or replace function public.push_quota_problem(p_cafe uuid, p_at timestamptz) returns text
language plpgsql stable security definer set search_path=public as $$
declare v_tier text; v_limit int; v_month timestamptz; v_used int;
begin
  select tier::text into v_tier from public.cafes where id=p_cafe;
  v_limit := public.push_monthly_limit(v_tier);
  if v_limit = 0 then return 'plan_no_campaigns'; end if;
  v_month := date_trunc('month', p_at at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad';
  select count(*) into v_used from public.push_campaigns
   where cafe_id=p_cafe and status in ('approved','sending','sent')
     and scheduled_at >= v_month and scheduled_at < v_month + interval '1 month';
  if v_used >= v_limit then return 'monthly_limit'; end if;
  return null;
end $$;

create or replace function public.approve_push_campaign(p_user uuid,p_campaign uuid,p_payload jsonb,p_hash text,p_code_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.push_campaigns%rowtype; ch public.step_up_challenges%rowtype; v_audience int; v_problem text;
begin
 -- A cafe lock serializes the monthly quota across different campaign rows.
 perform 1 from public.cafes where id=(select cafe_id from public.push_campaigns where id=p_campaign) for update;
 select * into c from public.push_campaigns where id=p_campaign for update;
 if not found or c.status <> 'draft' then return jsonb_build_object('error','not_draft'); end if;
 if not exists(select 1 from public.memberships where cafe_id=c.cafe_id and user_id=p_user and role='owner' and status='active') then
   return jsonb_build_object('error','not_owner');
 end if;
 if not public.cafe_can_earn(c.cafe_id) then return jsonb_build_object('error','subscription_inactive'); end if;
 if c.title is distinct from p_payload->'title' or c.body is distinct from p_payload->'body'
    or c.scheduled_at is distinct from (p_payload->>'at')::timestamptz then
   return jsonb_build_object('error','campaign_changed');
 end if;
 if c.scheduled_at < now()+interval '5 minutes' then return jsonb_build_object('error','schedule_too_soon'); end if;
 select * into ch from public.step_up_challenges where user_id=p_user and subject_id=p_campaign
   and purpose='push_approval' and used_at is null order by created_at desc limit 1 for update;
 if not found then return jsonb_build_object('error','no_challenge'); end if;
 if ch.expires_at <= now() then return jsonb_build_object('error','code_expired'); end if;
 if ch.attempts >= 5 then return jsonb_build_object('error','too_many_attempts'); end if;
 if ch.payload_hash <> p_hash then return jsonb_build_object('error','campaign_changed'); end if;
 if ch.code_hash <> p_code_hash then
   update public.step_up_challenges set attempts=attempts+1 where id=ch.id;
   return jsonb_build_object('error','wrong_code'); -- returning commits the attempt increment
 end if;
 v_problem := public.push_quota_problem(c.cafe_id, c.scheduled_at);
 if v_problem is not null then return jsonb_build_object('error', v_problem); end if;
 v_audience := public.push_audience_count(c.cafe_id);
 update public.step_up_challenges set used_at=now() where id=ch.id;
 update public.push_campaigns set status='approved',approval_hash=p_hash,approved_at=now(),approved_by=p_user,audience_count=v_audience where id=c.id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id) values(c.cafe_id,p_user,'push_approved','push_campaign',c.id::text);
 return jsonb_build_object('ok',true,'audience',v_audience);
end $$;

-- -----------------------------------------------------------------------------
-- Scan risk report
-- -----------------------------------------------------------------------------
create or replace function public.owner_risk_report(p_cafe uuid, p_days int default 30)
returns table(membership_id uuid, staff_id uuid, display_name text, stamps int, level text, reasons jsonb)
language plpgsql stable security definer set search_path=public as $$
#variable_conflict use_column
declare v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 90)));
begin
  if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then
    raise exception 'not_owner' using errcode='42501';
  end if;
  return query
  with staff as (
    select m.id as mid, m.user_id as uid, public.display_name(p.first_name, p.last_name) as dname
    from public.memberships m left join public.profiles p on p.id = m.user_id
    where m.cafe_id = p_cafe and m.role = 'barista' and m.status = 'active' and m.user_id is not null
  ),
  acc as (
    select e.* from public.stamp_events e
    where e.cafe_id = p_cafe and e.status = 'accepted' and e.scanned_at >= v_since and e.staff_id is not null
  ),
  totals as (
    select staff_id as uid, count(*)::int as n, count(*) filter (where offline)::int as off from acc group by staff_id
  ),
  -- 1. Too fast: busiest single hour vs. the cafe's usual hour.
  hours as (
    select staff_id as uid, date_trunc('hour', scanned_at) as h, count(*)::int as c from acc group by 1, 2
  ),
  peak as (select uid, max(c) as peak from hours group by uid),
  baseline as (select coalesce(avg(c), 0)::numeric as avg_hour from hours),
  -- 2. Favourite friends: share of a barista's stamps going to their top 3 customers.
  per_cust as (
    select staff_id as uid, user_id, count(*)::int as c,
           row_number() over (partition by staff_id order by count(*) desc) as rk
    from acc where user_id is not null group by staff_id, user_id
  ),
  top3 as (select uid, sum(c)::int as top from per_cust where rk <= 3 group by uid),
  -- 3. Night stamps (01:00 to 05:59 Baghdad).
  night as (
    select staff_id as uid, count(*)::int as c from acc
    where extract(hour from scanned_at at time zone 'Asia/Baghdad') between 1 and 5 group by staff_id
  ),
  -- 4. Many brand-new customers in one day (first-ever stamp at this cafe given by this barista).
  firsts as (
    select distinct on (e.user_id) e.user_id, e.staff_id, e.scanned_at
    from public.stamp_events e
    where e.cafe_id = p_cafe and e.status = 'accepted' and e.user_id is not null
    order by e.user_id, e.scanned_at
  ),
  new_days as (
    select staff_id as uid, (scanned_at at time zone 'Asia/Baghdad')::date as d, count(*)::int as c
    from firsts where scanned_at >= v_since and staff_id is not null group by 1, 2
  ),
  new_peak as (select uid, max(c) as c from new_days group by uid),
  -- 5. Two places at once: same customer at two branches within 30 minutes.
  twoplace as (
    select b.staff_id as uid, count(*)::int as c
    from acc a join acc b
      on a.user_id = b.user_id and a.id <> b.id
     and a.branch_id is not null and b.branch_id is not null and a.branch_id <> b.branch_id
     and b.scanned_at > a.scanned_at and b.scanned_at <= a.scanned_at + interval '30 minutes'
    group by b.staff_id
  ),
  -- 6. Offline much more than the rest of the cafe.
  cafe_off as (select case when count(*) = 0 then 0 else count(*) filter (where offline)::numeric / count(*) end as share from acc),
  -- Existing signal: repeated "scanned again too soon" rejections.
  rejects as (
    select staff_id as uid, count(*)::int as c from public.stamp_events
    where cafe_id = p_cafe and scanned_at >= v_since and reason = 'cooldown' and staff_id is not null group by staff_id
  ),
  scored as (
    select s.mid, s.uid, s.dname, coalesce(t.n, 0) as n,
      array_remove(array[
        case when coalesce(pk.peak, 0) >= greatest(25, 5 * bl.avg_hour) then jsonb_build_object('severity','red','text', format('Gave %s stamps in a single hour (usual: about %s).', pk.peak, round(bl.avg_hour)))
             when coalesce(pk.peak, 0) >= greatest(15, 3 * bl.avg_hour) then jsonb_build_object('severity','yellow','text', format('Gave %s stamps in a single hour (usual: about %s).', pk.peak, round(bl.avg_hour))) end,
        case when coalesce(t.n, 0) >= 15 and t3.top::numeric / t.n >= 0.6 then jsonb_build_object('severity','red','text', format('%s%% of their stamps went to the same 3 customers.', round(100.0 * t3.top / t.n)))
             when coalesce(t.n, 0) >= 15 and t3.top::numeric / t.n >= 0.4 then jsonb_build_object('severity','yellow','text', format('%s%% of their stamps went to the same 3 customers.', round(100.0 * t3.top / t.n))) end,
        case when coalesce(ni.c, 0) >= 5 then jsonb_build_object('severity','red','text', format('%s stamps given between 1:00 and 6:00 am.', ni.c))
             when coalesce(ni.c, 0) >= 1 then jsonb_build_object('severity','yellow','text', format('%s stamp(s) given between 1:00 and 6:00 am.', ni.c)) end,
        case when coalesce(np.c, 0) >= 30 then jsonb_build_object('severity','red','text', format('Signed up %s brand-new customers in one day.', np.c))
             when coalesce(np.c, 0) >= 15 then jsonb_build_object('severity','yellow','text', format('Signed up %s brand-new customers in one day.', np.c)) end,
        case when coalesce(tp.c, 0) >= 3 then jsonb_build_object('severity','red','text', format('%s times a customer was stamped at two branches within 30 minutes.', tp.c))
             when coalesce(tp.c, 0) >= 1 then jsonb_build_object('severity','yellow','text', format('%s time(s) a customer was stamped at two branches within 30 minutes.', tp.c)) end,
        case when coalesce(t.n, 0) >= 10 and t.off::numeric / t.n >= 0.8 then jsonb_build_object('severity','red','text', format('%s%% of their scans were offline (cafe average: %s%%).', round(100.0 * t.off / t.n), round(100 * co.share)))
             when coalesce(t.n, 0) >= 10 and t.off::numeric / t.n >= 0.5 and t.off::numeric / t.n >= 2 * co.share then jsonb_build_object('severity','yellow','text', format('%s%% of their scans were offline (cafe average: %s%%).', round(100.0 * t.off / t.n), round(100 * co.share))) end,
        case when coalesce(rj.c, 0) >= 8 then jsonb_build_object('severity','red','text', format('%s scans rejected for scanning the same customer again too soon.', rj.c))
             when coalesce(rj.c, 0) >= 3 then jsonb_build_object('severity','yellow','text', format('%s scans rejected for scanning the same customer again too soon.', rj.c)) end
      ], null) as rs
    from staff s
    cross join baseline bl cross join cafe_off co
    left join totals t on t.uid = s.uid
    left join peak pk on pk.uid = s.uid
    left join top3 t3 on t3.uid = s.uid
    left join night ni on ni.uid = s.uid
    left join new_peak np on np.uid = s.uid
    left join twoplace tp on tp.uid = s.uid
    left join rejects rj on rj.uid = s.uid
  )
  select sc.mid, sc.uid, sc.dname, sc.n,
    case when exists (select 1 from unnest(sc.rs) r where r->>'severity' = 'red') then 'red'
         when cardinality(sc.rs) > 0 then 'yellow' else 'green' end,
    to_jsonb(sc.rs)
  from scored sc
  order by case when exists (select 1 from unnest(sc.rs) r where r->>'severity' = 'red') then 0
                when cardinality(sc.rs) > 0 then 1 else 2 end, sc.n desc;
end $$;

revoke execute on function public.push_quota_problem(uuid, timestamptz) from public;
revoke execute on function public.owner_risk_report(uuid, int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.push_quota_problem(uuid, timestamptz) to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    grant execute on function public.owner_risk_report(uuid, int) to authenticated;
  end if;
end $$;

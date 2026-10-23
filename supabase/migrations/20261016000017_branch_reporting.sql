-- Branch reporting for café owners. Customers keep one card per café across all branches;
-- owners see which branch every stamp and redemption came from.

-- Stamps and redemptions per branch for the last p_days days.
create or replace function public.owner_branch_summary(p_cafe uuid, p_days int default 30)
returns table(branch_id uuid, branch_name text, active boolean, stamps int, redemptions int, customers int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
  select b.id, b.name, b.active,
    (select count(*)::int from public.stamp_events e where e.cafe_id = p_cafe and e.branch_id = b.id and e.status = 'accepted' and e.scanned_at >= v_since),
    (select count(*)::int from public.redemptions r where r.cafe_id = p_cafe and r.branch_id = b.id and r.status = 'accepted' and r.redeemed_at >= v_since),
    (select count(distinct e.user_id)::int from public.stamp_events e where e.cafe_id = p_cafe and e.branch_id = b.id and e.status = 'accepted' and e.scanned_at >= v_since)
  from public.branches b
  where b.cafe_id = p_cafe
  order by b.active desc, b.name;
end $$;

-- The most recent accepted stamps with their branch, barista and customer reference.
create or replace function public.owner_recent_stamps(p_cafe uuid, p_limit int default 50)
returns table(id uuid, scanned_at timestamptz, branch_name text, staff_name text, customer_ref text, offline boolean, flagged boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not (public.is_cafe_owner(p_cafe) or public.is_admin()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
  select e.id, e.scanned_at, coalesce(b.name, 'Unknown branch'),
    coalesce(public.display_name(p.first_name, p.last_name), 'Former staff'),
    case when e.user_id is null then 'deleted' else public.customer_ref(e.user_id, p_cafe) end,
    e.offline, e.flagged
  from public.stamp_events e
  left join public.branches b on b.id = e.branch_id
  left join public.profiles p on p.id = e.staff_id
  where e.cafe_id = p_cafe and e.status = 'accepted'
  order by e.scanned_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

revoke all on function public.owner_branch_summary(uuid, int) from public;
revoke all on function public.owner_recent_stamps(uuid, int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.owner_branch_summary(uuid, int) to authenticated;
    grant execute on function public.owner_recent_stamps(uuid, int) to authenticated;
  end if;
end $$;

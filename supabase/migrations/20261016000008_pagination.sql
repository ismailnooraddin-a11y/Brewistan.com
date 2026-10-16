-- Purpose-built JSON pages avoid PostgREST's row cap and don't expose customer UUIDs to owners.
create function public.owner_customers_page(p_cafe uuid,p_page int default 1,p_query text default '') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not(public.is_cafe_owner(p_cafe) or public.is_admin()) then raise exception 'not_owner' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>100 then raise exception 'invalid_page' using errcode='22023'; end if;
 with rows as materialized(select * from public.owner_customers(p_cafe)
  where coalesce(trim(p_query),'')='' or strpos(lower(display_name),lower(trim(p_query)))>0
  or strpos(lower(customer_ref),lower(trim(p_query)))>0),
 page as(select * from rows order by last_visit desc nulls last,customer_ref limit 50 offset (p_page-1)*50)
 select jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page),
 'total',(select count(*) from rows),'hasMore',(select count(*) from rows)>p_page*50,'page',p_page) into result;
 return result;
end $$;
revoke all on function public.owner_customers_page(uuid,int,text) from public,anon;
grant execute on function public.owner_customers_page(uuid,int,text) to authenticated;

create function public.owner_activity_page(p_cafe uuid,p_page int default 1) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare off int;
begin
 if not(public.is_cafe_owner(p_cafe) or public.is_admin()) then raise exception 'not_owner' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid_page' using errcode='22023'; end if;
 off:=(p_page-1)*50;
 return jsonb_build_object(
  'redemptions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select r.id,r.redeemed_at,r.offline,r.status,r.reason,r.void_reason,r.branch_id,
    case when p.id is null then 'Former staff' else public.display_name(p.first_name,p.last_name) end as staff_name
   from public.redemptions r left join public.profiles p on p.id=r.staff_id
   where r.cafe_id=p_cafe order by r.redeemed_at desc,r.id desc limit 50 offset off) x),
  'issues',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select s.id,s.scanned_at,s.status,s.reason,s.flagged,s.offline,
    case when p.id is null then 'Former staff' else public.display_name(p.first_name,p.last_name) end as staff_name
   from public.stamp_events s left join public.profiles p on p.id=s.staff_id
   where s.cafe_id=p_cafe and (s.status<>'accepted' or s.flagged) order by s.scanned_at desc,s.id desc limit 50 offset off) x),
  'audit',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select id,action,reason,created_at from public.audit_log where cafe_id=p_cafe order by created_at desc,id desc limit 50 offset off) x),
  'hasMore',exists(select 1 from public.redemptions where cafe_id=p_cafe offset off+50 limit 1)
    or exists(select 1 from public.stamp_events where cafe_id=p_cafe and (status<>'accepted' or flagged) offset off+50 limit 1)
    or exists(select 1 from public.audit_log where cafe_id=p_cafe offset off+50 limit 1));
end $$;
revoke all on function public.owner_activity_page(uuid,int) from public,anon;
grant execute on function public.owner_activity_page(uuid,int) to authenticated;
create index stamp_review_page_idx on public.stamp_events(cafe_id,scanned_at desc,id desc) where status<>'accepted' or flagged;
create index redemption_page_idx on public.redemptions(cafe_id,redeemed_at desc,id desc);

create function public.wallet_page(p_user uuid,p_after uuid default null,p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if p_user is null or p_limit is null or p_limit not between 1 and 50 then raise exception 'invalid_wallet_page' using errcode='22023'; end if;
 with ids as materialized(
  select cafe_id from public.user_cafe_progress where user_id=p_user
  union select cafe_id from public.rewards where user_id=p_user and status='available' and expires_at>now()
 ), page_ids as(select cafe_id from ids where p_after is null or cafe_id>p_after order by cafe_id limit p_limit),
 cards as (
  select i.cafe_id,c.name,c.tier,c.brand,c.logo_path,c.status,
   coalesce(p.archived,false) as archived,coalesce(p.stamps_in_current,0) as stamps_in_current,
   coalesce(p.completed_puzzles,0) as completed_puzzles,p.last_stamp_at,
   coalesce(pinned.stamps_required,cur.stamps_required,8) as stamps_required,
   coalesce(pinned.reward_label,cur.reward_label,'{"en":"Free Coffee"}'::jsonb) as reward_label,
   exists(select 1 from public.notification_mutes m where m.user_id=p_user and m.cafe_id=i.cafe_id) as muted,
   (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'expires_at',r.expires_at,'reward_label',rc.reward_label) order by r.issued_at,r.id),'[]')
    from public.rewards r join public.campaigns rc on rc.id=r.campaign_id
    where r.user_id=p_user and r.cafe_id=i.cafe_id and r.status='available' and r.expires_at>now()) as rewards
  from page_ids i join public.cafes c on c.id=i.cafe_id
  left join public.user_cafe_progress p on p.cafe_id=i.cafe_id and p.user_id=p_user
  left join public.campaigns pinned on pinned.id=p.campaign_id and pinned.cafe_id=i.cafe_id
  left join public.campaigns cur on cur.cafe_id=i.cafe_id and cur.active order by i.cafe_id
 ) select jsonb_build_object('cards',(select coalesce(jsonb_agg(to_jsonb(cards)),'[]') from cards),
  'nextCursor',case when exists(select 1 from ids where cafe_id>(select cafe_id from page_ids order by cafe_id desc limit 1))
    then (select cafe_id from page_ids order by cafe_id desc limit 1) else null end,
  'profile',(select jsonb_build_object('firstName',first_name,'lastName',last_name,'locale',locale,
    'completedTotal',coalesce((select sum(completed_puzzles) from public.user_cafe_progress where user_id=p_user),0))
    from public.profiles where id=p_user)) into result;
 return result;
end $$;
revoke all on function public.wallet_page(uuid,uuid,int) from public,anon,authenticated;
grant execute on function public.wallet_page(uuid,uuid,int) to service_role;

create function public.owner_staff_page(p_cafe uuid,p_since timestamptz,p_page int default 1) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not(public.is_cafe_owner(p_cafe) or public.is_admin()) then raise exception 'not_owner' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid_page' using errcode='22023'; end if;
 return jsonb_build_object('staff',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from
  (select * from public.owner_staff_report(p_cafe,p_since) order by membership_id limit 50 offset (p_page-1)*50) r),
  'hasMore',exists(select 1 from public.memberships where cafe_id=p_cafe offset p_page*50 limit 1),
  'branches',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]') from public.branches where cafe_id=p_cafe and active));
end $$;
revoke all on function public.owner_staff_page(uuid,timestamptz,int) from public,anon;
grant execute on function public.owner_staff_page(uuid,timestamptz,int) to authenticated;

create function public.staff_snapshot_data(p_user uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
  select c.id as c,c.name as n,coalesce(cp.cooldown_minutes,120) as cooldown,
   (select coalesce(jsonb_agg(jsonb_build_object('i',b.id,'n',b.name) order by b.id),'[]')
    from public.branches b where b.cafe_id=c.id and b.active and exists(
     select 1 from public.memberships m where m.cafe_id=c.id and m.user_id=p_user and m.role='barista'
      and m.status='active' and (m.branch_id is null or m.branch_id=b.id))) as b
  from public.cafes c left join public.campaigns cp on cp.cafe_id=c.id and cp.active
  where c.status='active' and exists(select 1 from public.memberships m where m.cafe_id=c.id and m.user_id=p_user and m.role='barista' and m.status='active')
  order by c.id
 ) x;
$$;
revoke all on function public.staff_snapshot_data(uuid) from public,anon,authenticated;
grant execute on function public.staff_snapshot_data(uuid) to service_role;

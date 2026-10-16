-- Bounded service housekeeping; never delete pending queues or financial/reward ledgers.
create or replace function public.claim_push_jobs(p_limit int default 25) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if extract(hour from now() at time zone 'Asia/Baghdad') not between 9 and 20 then return '[]'::jsonb; end if;
 update public.push_jobs set status='failed',last_error='lease_exhausted'
  where status='processing' and lease_until < now() and attempts >= 5;
 update public.push_jobs j set status='skipped',last_error='daily_reservation_expired'
 where j.status in ('pending','processing') and j.campaign_id is not null
 and exists(select 1 from public.push_deliveries d where d.campaign_id=j.campaign_id and d.user_id=j.user_id and d.day <> (now() at time zone 'Asia/Baghdad')::date);
 update public.push_jobs j set status='skipped',last_error='recipient_ineligible'
 where j.status in ('pending','processing') and
  ((j.campaign_id is not null and not exists(select 1 from public.push_campaigns pc where pc.id=j.campaign_id and pc.status='sending'))
   or exists(select 1 from public.notification_mutes m where m.user_id=j.user_id and m.cafe_id=j.cafe_id)
   or not exists(select 1 from public.cafes c where c.id=j.cafe_id and c.status='active')
   or not exists(select 1 from public.devices d where d.id=j.device_id and d.user_id=j.user_id and d.revoked_at is null and d.push_token is not null)
   or (j.reward_id is not null and not exists(select 1 from public.rewards r where r.id=j.reward_id and r.status='available' and r.expires_at>now())));
 with selected as (
   select id from public.push_jobs where attempts<5 and available_at<=now()
    and (status='pending' or (status='processing' and lease_until<now()))
    order by available_at,id limit greatest(1,least(p_limit,100)) for update skip locked
 ), claimed as (
   update public.push_jobs j set status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid()
   from selected s where j.id=s.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'claimToken',j.claim_token,'deviceId',d.id,'userId',j.user_id,'token',d.push_token,
   'locale',p.locale,'cafeId',j.cafe_id,'cafeName',c.name,'campaignId',j.campaign_id,'rewardId',j.reward_id,
   'reminderDays',j.reminder_days,'title',pc.title,'body',pc.body)), '[]') into result
   from claimed j join public.devices d on d.id=j.device_id join public.profiles p on p.id=j.user_id
   join public.cafes c on c.id=j.cafe_id left join public.push_campaigns pc on pc.id=j.campaign_id;
 return result;
end $$;

create or replace function public.ack_push_job(p_id uuid,p_claim uuid,p_result text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if p_result not in ('sent','failed','invalid_token') then raise exception 'invalid_push_result'; end if;
 update public.push_jobs set
  status=case when p_result='sent' then 'sent' when p_result='invalid_token' then 'skipped' when attempts>=5 then 'failed' else 'pending' end,
  available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::int)),
  lease_until=null,last_error=case when p_result='sent' then null else p_result end
 where id=p_id and claim_token=p_claim and status='processing' and lease_until>now();
 return found;
end $$;


create function public.maintenance_metrics() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 -- Bounded batches avoid an unbounded delete after a long outage.
 delete from public.notification_outbox where id in (select id from public.notification_outbox
  where status in ('sent','failed') and created_at<now()-interval '30 days' order by created_at limit 1000);
 delete from public.web_sessions where session_id in (select w.session_id from public.web_sessions w where not exists(select 1 from auth.sessions s where s.id=w.session_id) order by w.session_id limit 1000);
 delete from public.blocked_sessions where session_id in (select b.session_id from public.blocked_sessions b where not exists(select 1 from auth.sessions s where s.id=b.session_id) order by b.session_id limit 1000);
 delete from public.device_sessions where session_id in (select d.session_id from public.device_sessions d where not exists(select 1 from auth.sessions s where s.id=d.session_id) order by d.session_id limit 1000);
 select jsonb_build_object('pendingPush',(select count(*) from public.push_jobs where status in ('pending','processing')),
  'failedPush',(select count(*) from public.push_jobs where status='failed' and created_at>now()-interval '1 day'),
  'pendingNotices',(select count(*) from public.notification_outbox where status in ('pending','processing')),
  'failedNotices',(select count(*) from public.notification_outbox where status='failed' and created_at>now()-interval '1 day'),
  'oldestPendingPushAt',(select min(created_at) from public.push_jobs where status in ('pending','processing')),
  'oldestPendingNoticeAt',(select min(created_at) from public.notification_outbox where status in ('pending','processing')))
 into result; return result;
end $$;
revoke all on function public.maintenance_metrics() from public,anon,authenticated;
grant execute on function public.maintenance_metrics() to service_role;
create function public.admin_operations() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 return jsonb_build_object('pendingPush',(select count(*) from public.push_jobs where status in ('pending','processing')),
  'failedPush',(select count(*) from public.push_jobs where status='failed' and created_at>now()-interval '1 day'),
  'pendingNotices',(select count(*) from public.notification_outbox where status in ('pending','processing')),
  'failedNotices',(select count(*) from public.notification_outbox where status='failed' and created_at>now()-interval '1 day'),
  'oldestNotice',(select min(created_at) from public.notification_outbox where status in ('pending','processing')),
  'suspiciousOfflineDays',(select count(*) from (select staff_id,(scanned_at at time zone 'Asia/Baghdad')::date
    from public.stamp_events where offline and scanned_at>now()-interval '7 days'
    group by staff_id,(scanned_at at time zone 'Asia/Baghdad')::date having count(*)>200) flagged));
end $$;
revoke all on function public.admin_operations() from public,anon;
grant execute on function public.admin_operations() to authenticated;

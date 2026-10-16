-- Atomic OTP reservations, approval and durable per-device notification jobs.
-- External delivery is at-least-once: a worker crash after FCM accepts a message
-- but before acknowledgement can still duplicate it. Stable deliveryId permits deduplication.

create or replace function public.reserve_otp(p_phone_hash text, p_purpose text, p_phone_cap int, p_global_cap int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
 if p_phone_cap is null or p_global_cap is null or p_phone_hash is null or p_purpose not in ('login','step_up') or p_phone_cap < 1 or p_global_cap < 1 or char_length(p_phone_hash) <> 64 then
   return jsonb_build_object('error','invalid_otp_configuration');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('otp-reservation',0));
 if exists(select 1 from public.otp_log where phone_hash=p_phone_hash and created_at > now()-interval '1 minute') then
   return jsonb_build_object('error','otp_wait');
 end if;
 if (select count(*) from public.otp_log where phone_hash=p_phone_hash and created_at > now()-interval '1 day') >= p_phone_cap then
   return jsonb_build_object('error','phone_daily_cap');
 end if;
 if (select count(*) from public.otp_log where created_at > now()-interval '1 day') >= p_global_cap then
   return jsonb_build_object('error','otp_daily_cap');
 end if;
 insert into public.otp_log(phone_hash,purpose,delivered) values(p_phone_hash,p_purpose,false) returning id into v_id;
 return jsonb_build_object('id',v_id);
end $$;

create or replace function public.push_audience_count(p_cafe uuid) returns int
language sql stable security definer set search_path=public as $$
 select count(*)::int from public.user_cafe_progress p where p.cafe_id=p_cafe and not p.archived
 and not exists(select 1 from public.notification_mutes m where m.user_id=p.user_id and m.cafe_id=p.cafe_id);
$$;

create or replace function public.request_push_challenge(p_user uuid,p_campaign uuid,p_hash text,p_code_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_exp timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('step-up:' || p_user::text,0));
 if not exists(select 1 from public.push_campaigns c join public.memberships m on m.cafe_id=c.cafe_id
   where c.id=p_campaign and c.status='draft' and m.user_id=p_user and m.role='owner' and m.status='active') then
   return jsonb_build_object('error','not_draft_or_owner');
 end if;
 if (select count(*) from public.step_up_challenges where user_id=p_user and purpose='push_approval'
   and created_at > now()-interval '1 hour') >= 3 then return jsonb_build_object('error','too_many_codes'); end if;
 update public.step_up_challenges set used_at=now() where user_id=p_user and subject_id=p_campaign and used_at is null;
 insert into public.step_up_challenges(user_id,purpose,subject_id,payload_hash,code_hash,expires_at)
 values(p_user,'push_approval',p_campaign,p_hash,p_code_hash,now()+interval '5 minutes') returning id,expires_at into v_id,v_exp;
 return jsonb_build_object('id',v_id,'expiresAt',v_exp);
end $$;

create or replace function public.approve_push_campaign(p_user uuid,p_campaign uuid,p_payload jsonb,p_hash text,p_code_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.push_campaigns%rowtype; ch public.step_up_challenges%rowtype; v_week timestamptz; v_audience int;
begin
 -- A cafe lock serializes the weekly quota across different campaign rows.
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
 v_week := date_trunc('week', c.scheduled_at at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad';
 if (select count(*) from public.push_campaigns where cafe_id=c.cafe_id and status in ('approved','sending','sent')
     and scheduled_at >= v_week and scheduled_at < v_week+interval '7 days') >= 2 then
   return jsonb_build_object('error','weekly_limit');
 end if;
 v_audience := public.push_audience_count(c.cafe_id);
 update public.step_up_challenges set used_at=now() where id=ch.id;
 update public.push_campaigns set status='approved',approval_hash=p_hash,approved_at=now(),approved_by=p_user,audience_count=v_audience where id=c.id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id) values(c.cafe_id,p_user,'push_approved','push_campaign',c.id::text);
 return jsonb_build_object('ok',true,'audience',v_audience);
end $$;

alter table public.push_campaigns add column if not exists dispatch_version int not null default 1;
alter table public.push_campaigns add column if not exists failed_count int not null default 0;
create table public.push_jobs (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid references public.push_campaigns(id) on delete cascade,
 reward_id uuid references public.rewards(id) on delete cascade,
 reminder_days int check(reminder_days in (7,30)),
 user_id uuid not null references public.profiles(id) on delete cascade,
 cafe_id uuid not null references public.cafes(id) on delete cascade,
 device_id uuid not null references public.devices(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','skipped')),
 attempts int not null default 0,
 available_at timestamptz not null default now(),
 lease_until timestamptz,
 claim_token uuid,
 last_error text,
 created_at timestamptz not null default now(),
 check((campaign_id is not null and reward_id is null and reminder_days is null) or
       (campaign_id is null and reward_id is not null and reminder_days is not null)),
 unique(campaign_id,device_id),
 unique(reward_id,reminder_days,device_id)
);
alter table public.push_jobs enable row level security;
create index push_jobs_pending_idx on public.push_jobs(status,available_at);

create or replace function public.prepare_push_jobs() returns int
language plpgsql security definer set search_path=public as $$
declare c public.push_campaigns%rowtype; v_count int := 0; v_day date; v_days int;
begin
 if extract(hour from now() at time zone 'Asia/Baghdad') not between 9 and 20 then return 0; end if;
 v_day := (now() at time zone 'Asia/Baghdad')::date;
 for c in select * from public.push_campaigns where status='approved' and scheduled_at <= now()
   order by scheduled_at limit 10 for update skip locked loop
   if not public.cafe_can_earn(c.cafe_id) then
     update public.push_campaigns set status='cancelled' where id=c.id;
     continue;
   end if;
   insert into public.push_deliveries(user_id,cafe_id,day,campaign_id)
    select p.user_id,p.cafe_id,v_day,c.id from public.user_cafe_progress p
    where p.cafe_id=c.cafe_id and not p.archived
    and not exists(select 1 from public.notification_mutes m where m.user_id=p.user_id and m.cafe_id=p.cafe_id)
    on conflict do nothing;
   insert into public.push_jobs(campaign_id,user_id,cafe_id,device_id)
    select c.id,d.user_id,c.cafe_id,d.id from public.push_deliveries pd join public.devices d on d.user_id=pd.user_id
    where pd.campaign_id=c.id and d.revoked_at is null and d.push_token is not null on conflict do nothing;
   update public.push_campaigns set status='sending',dispatch_version=2,audience_count=(select count(*) from public.push_deliveries where campaign_id=c.id) where id=c.id;
   v_count := v_count+1;
 end loop;
 -- Reminders use the same durable queue and honor per-cafe mutes. They are transactional,
 -- not marketing; the daily campaign quota does not include reminders.
 foreach v_days in array array[30,7] loop
   insert into public.push_jobs(reward_id,reminder_days,user_id,cafe_id,device_id)
    select r.id,v_days,r.user_id,r.cafe_id,d.id from public.rewards r join public.devices d on d.user_id=r.user_id
    join public.cafes c on c.id=r.cafe_id
    where r.status='available' and c.status='active' and d.revoked_at is null and d.push_token is not null
    and not (case when v_days=30 then r.reminded_30 else r.reminded_7 end)
    and r.expires_at >= now()+make_interval(days=>v_days-1) and r.expires_at < now()+make_interval(days=>v_days)
    and not exists(select 1 from public.notification_mutes m where m.user_id=r.user_id and m.cafe_id=r.cafe_id)
    on conflict do nothing;
 end loop;
 return v_count;
end $$;

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
  (exists(select 1 from public.notification_mutes m where m.user_id=j.user_id and m.cafe_id=j.cafe_id)
   or not exists(select 1 from public.cafes c where c.id=j.cafe_id and c.status='active')
   or not exists(select 1 from public.devices d where d.id=j.device_id and d.revoked_at is null and d.push_token is not null)
   or (j.reward_id is not null and not exists(select 1 from public.rewards r where r.id=j.reward_id and r.status='available' and r.expires_at>now())));
 with selected as (
   select id from public.push_jobs where attempts<5 and available_at<=now()
    and (status='pending' or (status='processing' and lease_until<now()))
    order by available_at,id limit greatest(1,least(p_limit,100)) for update skip locked
 ), claimed as (
   update public.push_jobs j set status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid()
   from selected s where j.id=s.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'claimToken',j.claim_token,'deviceId',d.id,'token',d.push_token,
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
 where id=p_id and claim_token=p_claim and status='processing';
 return found;
end $$;

create or replace function public.finish_push_campaigns() returns int
language plpgsql security definer set search_path=public as $$
declare n int;
begin
 update public.push_campaigns c set status='sent',sent_at=now(),
   delivered_count=(select count(distinct user_id) from public.push_jobs where campaign_id=c.id and status='sent'),
   failed_count=(select count(distinct user_id) from public.push_jobs where campaign_id=c.id and status='failed')
 where c.status='sending' and c.dispatch_version=2 and not exists(select 1 from public.push_jobs where campaign_id=c.id and status in ('pending','processing'));
 get diagnostics n=row_count;
 return n;
end $$;

-- Explicitly revoke platform-default authenticated/anon grants on every new service function.
revoke all on function public.reserve_otp(text,text,int,int) from public,anon,authenticated;
revoke all on function public.push_audience_count(uuid) from public,anon,authenticated;
revoke all on function public.request_push_challenge(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.approve_push_campaign(uuid,uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.prepare_push_jobs() from public,anon,authenticated;
revoke all on function public.claim_push_jobs(int) from public,anon,authenticated;
revoke all on function public.ack_push_job(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_push_campaigns() from public,anon,authenticated;
grant execute on function public.reserve_otp(text,text,int,int),public.push_audience_count(uuid),
 public.request_push_challenge(uuid,uuid,text,text),public.approve_push_campaign(uuid,uuid,jsonb,text,text),
 public.prepare_push_jobs(),public.claim_push_jobs(int),public.ack_push_job(uuid,uuid,text),public.finish_push_campaigns() to service_role;

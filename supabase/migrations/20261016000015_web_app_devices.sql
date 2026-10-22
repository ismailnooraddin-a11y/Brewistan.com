-- The customer and staff app also runs as a web app (PWA) at app.brewistan.com.
-- Allow 'web' as a device platform. Everything else in register_device is unchanged from migration 05.
alter table public.devices drop constraint if exists devices_platform_check;
alter table public.devices add constraint devices_platform_check check (platform in ('android', 'ios', 'web'));

create or replace function public.register_device(p_user uuid,p_key text,p_platform text,p_device uuid,p_push text,p_version text,p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.devices%rowtype; v_new boolean := false;
begin
 if p_user is null or p_key is null or p_platform is null or p_key !~ '^[A-Za-z0-9_-]{43}$' or p_platform not in ('ios','android','web') or
    length(coalesce(p_push,'')) > 4096 or length(coalesce(p_version,'')) > 60 or
    p_expires is null or p_expires <= now() or p_expires > now()+interval '31 days' then
   raise exception 'invalid_registration' using errcode='22023';
 end if;
 if p_push is not null then perform pg_advisory_xact_lock(hashtextextended('push-token:'||p_push,0)); end if;
 perform pg_advisory_xact_lock(hashtextextended('registration:'||p_user::text,0));
 if p_device is not null then
   select * into d from public.devices where id=p_device and user_id=p_user for update;
   if not found or d.public_key<>p_key or d.revoked_at is not null then
     raise exception 'device_revoked_or_unknown' using errcode='22023';
   end if;
 else
   select * into d from public.devices where user_id=p_user and public_key=p_key and revoked_at is null
    order by last_seen_at desc,id limit 1 for update;
   if not found and exists(select 1 from public.devices where user_id=p_user and public_key=p_key and revoked_at is not null) then
     raise exception 'device_revoked' using errcode='22023';
   end if;
 end if;
 if d.id is null then
   if (select count(*) from public.devices where user_id=p_user and revoked_at is null) >= 20 then
     raise exception 'device_limit' using errcode='22023';
   end if;
   insert into public.devices(user_id,public_key,platform,cert_expires_at) values(p_user,p_key,p_platform,p_expires) returning * into d;
   v_new := true;
 end if;
 -- A physical install must not receive private notifications for the last account.
 if p_push is not null then update public.devices set push_token=null where push_token=p_push and id<>d.id; end if;
 update public.devices set push_token=p_push,app_version=p_version,cert_expires_at=p_expires,last_seen_at=now() where id=d.id;
 return jsonb_build_object('deviceId',d.id,'isNew',v_new);
end $$;

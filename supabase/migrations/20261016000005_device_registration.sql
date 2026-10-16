-- Do not let deleting an assigned branch promote a barista to all branches.
alter table public.memberships drop constraint memberships_branch_id_fkey;
alter table public.memberships add constraint memberships_branch_id_fkey foreign key(branch_id)
 references public.branches(id) on delete restrict;

-- Legacy profiles may contain numbers inserted before verification was required.
update public.profiles p set phone=null from auth.users u where p.id=u.id and u.phone_confirmed_at is null;

create or replace function public.register_device(p_user uuid,p_key text,p_platform text,p_device uuid,p_push text,p_version text,p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.devices%rowtype; v_new boolean := false;
begin
 if p_user is null or p_key is null or p_platform is null or p_key !~ '^[A-Za-z0-9_-]{43}$' or p_platform not in ('ios','android') or
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
revoke all on function public.register_device(uuid,text,text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.register_device(uuid,text,text,uuid,text,text,timestamptz) to service_role;
revoke all on function public.cafe_can_earn(uuid) from public,anon,authenticated;
grant execute on function public.cafe_can_earn(uuid) to service_role;

-- This helper returns full staff rows and is not a public directory RPC.
revoke all on function public.barista_membership(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.barista_membership(uuid,uuid,uuid,timestamptz) to service_role;

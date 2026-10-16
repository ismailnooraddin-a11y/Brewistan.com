-- Authoritative API session and device trust. Never modify earlier migration history.
create table public.blocked_sessions (
 session_id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null, blocked_at timestamptz not null default now()
);
create table public.device_sessions (
 session_id uuid primary key, device_id uuid not null references public.devices(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 linked_at timestamptz not null default now()
);
create index device_sessions_device_idx on public.device_sessions(device_id);
create table public.web_sessions (
 session_id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 authenticated_at timestamptz not null, last_seen_at timestamptz not null default now()
);
alter table public.blocked_sessions enable row level security;
alter table public.device_sessions enable row level security;
alter table public.web_sessions enable row level security;

create or replace function public.session_allowed(p_user uuid, p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_user is not null and p_session is not null
 and exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_user
   and (s.not_after is null or s.not_after>now()))
 and not exists(select 1 from public.blocked_sessions b where b.session_id=p_session)
 and not exists(select 1 from public.web_sessions w where w.session_id=p_session and
   (w.user_id<>p_user or w.authenticated_at<=now()-interval '12 hours' or w.last_seen_at<=now()-interval '2 hours'));
$$;
revoke all on function public.session_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.session_allowed(uuid,uuid) to service_role;

create or replace function public.current_session_allowed() returns boolean
language plpgsql stable security definer set search_path=public as $$
declare s uuid;
begin
 begin s := nullif(auth.jwt()->>'session_id','')::uuid; exception when invalid_text_representation then return false; end;
 return public.session_allowed(auth.uid(),s);
end $$;
revoke all on function public.current_session_allowed() from public,anon;
grant execute on function public.current_session_allowed() to authenticated;

-- Authenticated clients cannot use a still-unexpired JWT after server revocation.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select public.current_session_allowed() and coalesce(auth.jwt()->>'aal','aal1')='aal2'
 and exists(select 1 from public.admins where user_id=auth.uid());
$$;
create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path=public as $$
 select public.current_session_allowed() and exists(select 1 from public.admins where user_id=auth.uid());
$$;
create or replace function public.is_cafe_owner(p_cafe uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.current_session_allowed() and exists(select 1 from public.memberships
 where cafe_id=p_cafe and user_id=auth.uid() and role='owner' and status='active');
$$;
create or replace function public.is_cafe_member(p_cafe uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.current_session_allowed() and exists(select 1 from public.memberships
 where cafe_id=p_cafe and user_id=auth.uid() and status='active');
$$;
-- Restrictive policy is ANDed with each table's tenant/identity policies.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('create policy live_session on public.%I as restrictive for all to authenticated using ((select public.current_session_allowed())) with check ((select public.current_session_allowed()))',t.tablename);
 end loop;
end $$;
create policy live_session on storage.objects as restrictive for all to authenticated
 using ((select public.current_session_allowed())) with check ((select public.current_session_allowed()));

create function public.touch_web_session() returns boolean
language plpgsql security definer set search_path=public as $$
declare s uuid; started timestamptz; w public.web_sessions%rowtype;
begin
 begin s := nullif(auth.jwt()->>'session_id','')::uuid; exception when invalid_text_representation then return false; end;
 if not public.session_allowed(auth.uid(),s) then return false; end if;
 select created_at into started from auth.sessions where id=s and user_id=auth.uid();
 if started is null or started<=now()-interval '12 hours' then return false; end if;
 -- Register an envelope only following a recent primary login. Deleting cookies is not a reset.
 perform pg_advisory_xact_lock(hashtextextended('web-session:'||s::text,0));
 select * into w from public.web_sessions where session_id=s for update;
 if not found then
  if started<now()-interval '5 minutes' then return false; end if;
  insert into public.web_sessions(session_id,user_id,authenticated_at) values(s,auth.uid(),started);
 else
  if w.last_seen_at<=now()-interval '2 hours' then return false; end if;
  update public.web_sessions set last_seen_at=now() where session_id=s;
 end if;
 return true;
end $$;
revoke all on function public.touch_web_session() from public,anon;
grant execute on function public.touch_web_session() to authenticated;

create function public.block_revoked_device_sessions() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.revoked_at is not null and old.revoked_at is null then
  insert into public.blocked_sessions(session_id,user_id,reason)
   select session_id,user_id,'device_revoked' from public.device_sessions where device_id=new.id
   on conflict(session_id) do nothing;
  new.push_token:=null;
 end if;
 return new;
end $$;
create trigger block_revoked_device_sessions before update of revoked_at on public.devices
 for each row execute function public.block_revoked_device_sessions();

create function public.register_session_device(p_user uuid,p_session uuid,p_key text,p_platform text,
 p_device uuid,p_push text,p_version text,p_expires timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; linked uuid; recent boolean;
begin
 -- Same lock order for enrollment and revocation. A revoked session cannot rotate to a new key.
 perform pg_advisory_xact_lock(hashtextextended('device-trust:'||p_user::text,0));
 if not public.session_allowed(p_user,p_session) then raise exception 'session_revoked' using errcode='22023'; end if;
 select device_id into linked from public.device_sessions where session_id=p_session;
 if linked is not null then
  if not exists(select 1 from public.devices where id=linked and user_id=p_user and public_key=p_key and revoked_at is null)
    or (p_device is not null and linked<>p_device) then
   raise exception 'device_session_mismatch' using errcode='22023';
  end if;
 else
  select created_at>now()-interval '10 minutes' into recent from auth.sessions where id=p_session and user_id=p_user;
  -- Migrating an already registered key is allowed with its proof of possession (Edge verifies).
  if not coalesce(recent,false) and not exists(select 1 from public.devices where user_id=p_user
     and public_key=p_key and revoked_at is null and (p_device is null or id=p_device)) then
   raise exception 'recent_login_required' using errcode='22023';
  end if;
 end if;
 result:=public.register_device(p_user,p_key,p_platform,coalesce(linked,p_device),p_push,p_version,p_expires);
 insert into public.device_sessions(session_id,device_id,user_id) values(p_session,(result->>'deviceId')::uuid,p_user)
  on conflict(session_id) do nothing;
 return result;
end $$;
revoke all on function public.register_session_device(uuid,uuid,text,text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.register_session_device(uuid,uuid,text,text,uuid,text,text,timestamptz) to service_role;

create function public.revoke_my_device(p_device uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_session_allowed() then raise exception 'session_revoked' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('device-trust:'||auth.uid()::text,0));
 update public.devices set revoked_at=coalesce(revoked_at,now()),push_token=null where id=p_device and user_id=auth.uid();
 if not found then raise exception 'device_not_found' using errcode='22023'; end if;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'device_revoked','device',p_device::text);
end $$;
revoke all on function public.revoke_my_device(uuid) from public,anon;
grant execute on function public.revoke_my_device(uuid) to authenticated;

create function public.detach_my_push(p_device uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_session_allowed() then raise exception 'session_revoked' using errcode='42501'; end if;
 update public.devices set push_token=null where id=p_device and user_id=auth.uid();
end $$;
revoke all on function public.detach_my_push(uuid) from public,anon;
grant execute on function public.detach_my_push(uuid) to authenticated;

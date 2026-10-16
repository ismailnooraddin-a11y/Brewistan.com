-- A transfer requires current-owner initiation, recipient acceptance and MFA-admin completion.
create table public.ownership_transfers (
 id uuid primary key default gen_random_uuid(), cafe_id uuid not null references public.cafes(id) on delete cascade,
 from_user uuid references public.profiles(id) on delete set null,
 to_user uuid references public.profiles(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','accepted','completed','cancelled')),
 expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now(),
 accepted_at timestamptz, completed_at timestamptz, reason text,
 reviewed_by uuid references public.profiles(id) on delete set null,
 check(from_user is null or to_user is null or from_user is distinct from to_user)
);
create unique index one_open_transfer on public.ownership_transfers(cafe_id) where status in ('pending','accepted');
alter table public.ownership_transfers enable row level security;
create policy transfer_read on public.ownership_transfers for select to authenticated using(
 public.current_session_allowed() and (from_user=auth.uid() or to_user=auth.uid() or public.is_admin()));
create function public.request_ownership_transfer(p_cafe uuid,p_phone text) returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid; transfer_id uuid;
begin
 if not public.is_cafe_owner(p_cafe) then raise exception 'not_owner' using errcode='42501'; end if;
 perform 1 from public.cafes where id=p_cafe and owner_id=auth.uid() for update;
 if not found then raise exception 'owner_changed' using errcode='22023'; end if;
 select p.id into target from public.profiles p join auth.users u on u.id=p.id
 where p.phone=public.normalize_phone(p_phone) and u.phone_confirmed_at is not null;
 if target is null or target=auth.uid() then raise exception 'recipient_must_have_verified_account' using errcode='22023'; end if;
 update public.ownership_transfers set status='cancelled',reason='expired' where cafe_id=p_cafe and status in ('pending','accepted') and expires_at<=now();
 select id into transfer_id from public.ownership_transfers where cafe_id=p_cafe and to_user=target and from_user=auth.uid() and status in ('pending','accepted');
 if found then return transfer_id; end if;
 insert into public.ownership_transfers(cafe_id,from_user,to_user) values(p_cafe,auth.uid(),target) returning id into transfer_id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id) values(p_cafe,auth.uid(),'ownership_requested','ownership_transfer',transfer_id::text);
 return transfer_id;
end $$;
create function public.respond_ownership_transfer(p_transfer uuid,p_accept boolean) returns void
language plpgsql security definer set search_path=public as $$
declare t public.ownership_transfers%rowtype;
begin
 if not public.current_session_allowed() then raise exception 'session_revoked' using errcode='42501'; end if;
 if p_accept is null then raise exception 'decision_required' using errcode='22023'; end if;
 select * into t from public.ownership_transfers where id=p_transfer for update;
 if not found or (auth.uid() is distinct from t.from_user and auth.uid() is distinct from t.to_user) then raise exception 'not_participant' using errcode='42501'; end if;
 if p_accept then
  if auth.uid() is distinct from t.to_user then raise exception 'recipient_only' using errcode='42501'; end if;
  if t.status='accepted' then return; end if;
  if t.status<>'pending' or t.expires_at<=now() then raise exception 'transfer_not_pending' using errcode='22023'; end if;
  update public.ownership_transfers set status='accepted',accepted_at=now() where id=t.id;
 else
  if t.status='cancelled' then return; end if;
  if t.status not in ('pending','accepted') then raise exception 'transfer_closed' using errcode='22023'; end if;
  update public.ownership_transfers set status='cancelled' where id=t.id;
 end if;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id) values(t.cafe_id,auth.uid(),
  case when p_accept then 'ownership_accepted' else 'ownership_cancelled' end,'ownership_transfer',t.id::text);
end $$;
create function public.complete_ownership_transfer(p_transfer uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare t public.ownership_transfers%rowtype; phone_number text; current_owner uuid;
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception 'reason_required' using errcode='22023'; end if;
 -- Lock cafe before transfer to match initiation's lock order.
 select * into t from public.ownership_transfers where id=p_transfer;
 if not found then raise exception 'transfer_not_found' using errcode='22023'; end if;
 select owner_id into current_owner from public.cafes where id=t.cafe_id for update;
 select * into t from public.ownership_transfers where id=p_transfer for update;
 if t.status='completed' then return; end if;
 if t.status<>'accepted' or t.expires_at<=now() or t.from_user is distinct from current_owner or t.to_user is null then
  raise exception 'transfer_not_eligible' using errcode='22023'; end if;
 select p.phone into phone_number from public.profiles p join auth.users u on u.id=p.id where p.id=t.to_user and u.phone_confirmed_at is not null;
 if phone_number is null then raise exception 'recipient_not_verified' using errcode='22023'; end if;
 update public.memberships set status='revoked',revoked_at=now() where cafe_id=t.cafe_id and role='owner' and status<>'revoked';
 -- Remove a pre-existing barista assignment for the new owner; owners cannot collect staff rewards.
 update public.memberships set status='revoked',revoked_at=now() where cafe_id=t.cafe_id and role='barista' and user_id=t.to_user and status<>'revoked';
 insert into public.memberships(cafe_id,user_id,phone,role,status,activated_at,confirmed_at,invited_by)
 values(t.cafe_id,t.to_user,phone_number,'owner','active',now(),now(),auth.uid());
 update public.cafes set owner_id=t.to_user where id=t.cafe_id;
 -- Old-owner campaign authorizations do not survive ownership transfer.
 update public.push_campaigns set status='cancelled' where cafe_id=t.cafe_id and status in ('draft','approved','sending');
 update public.push_jobs set status='skipped',last_error='ownership_transfer',lease_until=null
 where cafe_id=t.cafe_id and campaign_id is not null and status in ('pending','processing');
 update public.step_up_challenges set used_at=now() where subject_id in(select id from public.push_campaigns where cafe_id=t.cafe_id) and used_at is null;
 update public.ownership_transfers set status='completed',completed_at=now(),reviewed_by=auth.uid(),reason=btrim(p_reason) where id=t.id;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id,reason)
 values(t.cafe_id,auth.uid(),'ownership_completed','ownership_transfer',t.id::text,btrim(p_reason));
end $$;
revoke all on function public.request_ownership_transfer(uuid,text),public.respond_ownership_transfer(uuid,boolean),
 public.complete_ownership_transfer(uuid,text) from public,anon;
grant execute on function public.request_ownership_transfer(uuid,text),public.respond_ownership_transfer(uuid,boolean),
 public.complete_ownership_transfer(uuid,text) to authenticated;
-- Historical marketing records no longer prevent a former owner's deletion.
alter table public.push_campaigns alter column created_by drop not null;
alter table public.push_campaigns drop constraint push_campaigns_created_by_fkey;
alter table public.push_campaigns add constraint push_campaigns_created_by_fkey
 foreign key(created_by) references public.profiles(id) on delete set null;

create or replace function public.push_campaigns_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_local_hour int;
begin
  -- The FK's nested deletion update may only erase identity fields, never rewrite content.
  if tg_op='UPDATE' and pg_trigger_depth()>1 and new.created_by is null and old.created_by is not null
    and not exists(select 1 from public.profiles where id=old.created_by)
    and (to_jsonb(new)-'created_by'-'approved_by')=(to_jsonb(old)-'created_by'-'approved_by') then return new; end if;
  if not public.is_privileged() then
    if tg_op = 'UPDATE' then
      new.status := case when new.status = 'cancelled' then 'cancelled'::public.push_status else old.status end;
      new.approval_hash := old.approval_hash;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
      new.sent_at := old.sent_at;
      new.cafe_id := old.cafe_id;
      new.created_by := old.created_by;
    else
      new.status := 'draft';
      new.created_by := auth.uid();
      new.approval_hash := null;
      new.approved_at := null;
      new.approved_by := null;
    end if;

    if new.status = 'draft' then
      v_local_hour := extract(hour from (new.scheduled_at at time zone 'Asia/Baghdad'));
      if v_local_hour < 9 or v_local_hour >= 21 then
        raise exception 'send_window: campaigns must be scheduled between 09:00 and 21:00 Baghdad time'
          using errcode = '22023';
      end if;
      if new.scheduled_at < now() + interval '10 minutes' then
        raise exception 'schedule_too_soon: schedule at least 10 minutes ahead' using errcode = '22023';
      end if;
      if coalesce(new.title ->> 'en', '') = '' or coalesce(new.body ->> 'en', '') = '' then
        raise exception 'missing_english: an English title and body are required' using errcode = '22023';
      end if;
      if char_length(coalesce(new.body ->> 'en', '')) > 240 then
        raise exception 'body_too_long: keep the message under 240 characters' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end $$;


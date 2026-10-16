-- State, audit and delivery intent commit together. External delivery remains at-least-once.
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(), cafe_id uuid references public.cafes(id) on delete cascade,
 recipient_id uuid references public.profiles(id) on delete cascade, phone text not null,
 template_key text not null check(template_key in ('staffInvite','staffChange','cafeApproved','cafeRejected')),
 locale text not null default 'en', params jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts int not null default 0, available_at timestamptz not null default now(),
 lease_until timestamptz, claim_token uuid, last_error text, created_at timestamptz not null default now()
);
create index outbox_claim_idx on public.notification_outbox(status,available_at);
alter table public.notification_outbox enable row level security;

create function public.staff_manage_atomic(p_cafe uuid,p_action text,p_phone text default null,
 p_branch uuid default null,p_member uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.cafes%rowtype; m public.memberships%rowtype; who public.profiles%rowtype;
 owner_profile public.profiles%rowtype; change_text text;
begin
 if not public.is_cafe_owner(p_cafe) then raise exception 'not_owner' using errcode='42501'; end if;
 select * into c from public.cafes where id=p_cafe for update;
 if not found or c.owner_id<>auth.uid() then raise exception 'not_owner' using errcode='42501'; end if;
 if c.status='closed' then raise exception 'cafe_closed' using errcode='22023'; end if;
 select * into owner_profile from public.profiles where id=c.owner_id;
 if p_action='invite' then
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then raise exception 'invalid_phone' using errcode='22023'; end if;
  if p_phone=owner_profile.phone then raise exception 'cannot_invite_self' using errcode='22023'; end if;
  if p_branch is not null and not exists(select 1 from public.branches where id=p_branch and cafe_id=p_cafe and active) then
   raise exception 'branch_mismatch' using errcode='22023'; end if;
  select * into m from public.memberships where cafe_id=p_cafe and phone=p_phone and role='barista' and status<>'revoked';
  if found then
   if m.branch_id is distinct from p_branch then raise exception 'already_invited_other_branch' using errcode='22023'; end if;
   return jsonb_build_object('ok',true,'membershipId',m.id,'status',m.status,'duplicate',true);
  end if;
  select pr.* into who from public.profiles pr join auth.users u on u.id=pr.id
   where pr.phone=p_phone and u.phone_confirmed_at is not null;
  insert into public.memberships(cafe_id,branch_id,phone,role,user_id,status,activated_at,invited_by)
   values(p_cafe,p_branch,p_phone,'barista',who.id,
    case when who.id is null then 'invited'::public.member_status else 'active'::public.member_status end,
    case when who.id is not null then now() end,auth.uid()) returning * into m;
  insert into public.notification_outbox(cafe_id,recipient_id,phone,template_key,locale,params)
   values(p_cafe,who.id,p_phone,'staffInvite',coalesce(who.locale,'en'),jsonb_build_array(c.name));
  change_text:='Barista added: +'||p_phone;
 elsif p_action in ('remove','confirm') then
  select * into m from public.memberships where id=p_member and cafe_id=p_cafe for update;
  if not found or m.role<>'barista' then raise exception 'membership_not_found' using errcode='22023'; end if;
  if p_action='remove' then
   if m.status='revoked' then return jsonb_build_object('ok',true,'duplicate',true); end if;
   update public.memberships set status='revoked',revoked_at=now() where id=m.id;
   change_text:='Barista removed: +'||m.phone;
  else
   if m.status<>'active' then raise exception 'staff_not_active' using errcode='22023'; end if;
   if m.confirmed_at is not null then return jsonb_build_object('ok',true,'duplicate',true); end if;
   update public.memberships set confirmed_at=now() where id=m.id;
  end if;
 else raise exception 'invalid_action' using errcode='22023'; end if;
 if change_text is not null and owner_profile.phone is not null then
  insert into public.notification_outbox(cafe_id,recipient_id,phone,template_key,locale,params)
   values(p_cafe,c.owner_id,owner_profile.phone,'staffChange',owner_profile.locale,jsonb_build_array(c.name,change_text));
 end if;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id)
  values(p_cafe,auth.uid(),'staff_'||p_action,'membership',m.id::text);
 return jsonb_build_object('ok',true,'membershipId',m.id,'status',case when p_action='remove' then 'revoked' else m.status::text end);
end $$;
revoke all on function public.staff_manage_atomic(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.staff_manage_atomic(uuid,text,text,uuid,uuid) to authenticated;

create function public.admin_review_atomic(p_cafe uuid,p_decision text,p_reason text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.cafes%rowtype; who public.profiles%rowtype; target public.cafe_status; template text; params jsonb;
begin
 if not public.is_admin() then raise exception 'admin_mfa_required' using errcode='42501'; end if;
 if p_reason is null or length(p_reason)>1000 then raise exception 'invalid_reason' using errcode='22023'; end if;
 select * into c from public.cafes where id=p_cafe for update;
 if not found then raise exception 'cafe_not_found' using errcode='22023'; end if;
 case p_decision
 when 'approve' then
  if c.status='active' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if c.status not in ('pending','rejected') then raise exception 'not_pending' using errcode='22023'; end if;
  target:='active'; template:='cafeApproved'; params:=jsonb_build_array(c.name);
 when 'reject' then
  if c.status='rejected' and c.rejection_reason=btrim(p_reason) then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if c.status<>'pending' then raise exception 'not_pending' using errcode='22023'; end if;
  if length(btrim(p_reason))<3 then raise exception 'reason_required' using errcode='22023'; end if;
  target:='rejected'; template:='cafeRejected'; params:=jsonb_build_array(c.name,btrim(p_reason));
 when 'suspend' then
  if c.status='suspended' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if c.status<>'active' then raise exception 'not_active' using errcode='22023'; end if;
  if length(btrim(p_reason))<3 then raise exception 'reason_required' using errcode='22023'; end if;
  target:='suspended';
 when 'reactivate' then
  if c.status='active' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if c.status<>'suspended' then raise exception 'not_suspended' using errcode='22023'; end if;
  target:='active';
 else raise exception 'invalid_decision' using errcode='22023'; end case;
 update public.cafes set status=target,
  approved_at=case when p_decision='approve' then now() else approved_at end,
  rejected_at=case when p_decision='reject' then now() else rejected_at end,
  rejection_reason=case when p_decision='reject' then btrim(p_reason) when p_decision='approve' then null else rejection_reason end
  where id=p_cafe;
 insert into public.audit_log(cafe_id,actor_id,action,entity,entity_id,reason)
  values(p_cafe,auth.uid(),'cafe_'||p_decision,'cafe',p_cafe::text,nullif(btrim(p_reason),''));
 if template is not null then
  select * into who from public.profiles where id=c.owner_id;
  if who.phone is not null then
   insert into public.notification_outbox(cafe_id,recipient_id,phone,template_key,locale,params)
    values(p_cafe,who.id,who.phone,template,who.locale,params);
  end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_review_atomic(uuid,text,text) from public,anon;
grant execute on function public.admin_review_atomic(uuid,text,text) to authenticated;

create function public.claim_notice_jobs(p_limit int default 10) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 update public.notification_outbox set status='failed',lease_until=null,last_error='attempts_exhausted'
  where status='processing' and lease_until<=now() and attempts>=5;
 with chosen as (
  select id from public.notification_outbox where attempts<5 and
   ((status='pending' and available_at<=now()) or (status='processing' and lease_until<=now()))
  order by available_at,id for update skip locked limit least(greatest(p_limit,1),25)
 ), claimed as (
  update public.notification_outbox j set status='processing',attempts=attempts+1,
   lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid()
  from chosen c where j.id=c.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'claimToken',claim_token,'phone',phone,
  'templateKey',template_key,'locale',locale,'params',params)),'[]'::jsonb) into result from claimed;
 return result;
end $$;
create function public.ack_notice_job(p_id uuid,p_claim uuid,p_success boolean) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 update public.notification_outbox set status=case when p_success then 'sent' when attempts>=5 then 'failed' else 'pending' end,
  available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::int)),
  lease_until=null,claim_token=null,last_error=case when p_success then null else 'provider_failed' end
 where id=p_id and status='processing' and claim_token=p_claim and lease_until>now();
 return found;
end $$;
revoke all on function public.claim_notice_jobs(int),public.ack_notice_job(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_notice_jobs(int),public.ack_notice_job(uuid,uuid,boolean) to service_role;

-- Retain accounting records without preventing a former owner's account deletion.
alter table public.payment_reports alter column reported_by drop not null;
alter table public.payment_reports drop constraint payment_reports_reported_by_fkey;
alter table public.payment_reports add constraint payment_reports_reported_by_fkey
 foreign key(reported_by) references public.profiles(id) on delete set null;

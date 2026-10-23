-- 2026-10-23: close elevated-RPC session checks; make cafe setup atomic and
-- retry-safe; preserve permanent QR slugs with valid long-name boundaries.
-- This is additive: never modify already deployed migrations 01-17.

create or replace function public.join_cafe(p_cafe uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.current_session_allowed() then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and first_name is not null and last_name is not null and gender is not null) then
    raise exception 'profile_incomplete' using errcode = '22023';
  end if;
  if not exists (select 1 from public.cafes where id = p_cafe and status = 'active') then
    raise exception 'cafe_unavailable' using errcode = '22023';
  end if;
  insert into public.user_cafe_progress (user_id, cafe_id) values (v_uid, p_cafe)
  on conflict (user_id, cafe_id) do update set archived = false where public.user_cafe_progress.archived;
  return jsonb_build_object('cafeId', p_cafe, 'joined', true);
end $$;

create or replace function public.complete_profile(p_first text, p_last text, p_gender text, p_email text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_first text := btrim(coalesce(p_first, '')); v_last text := btrim(coalesce(p_last, ''));
        v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v_uid is null or not public.current_session_allowed() then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  if char_length(v_first) not between 1 and 40 or char_length(v_last) not between 1 and 40 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_gender is null or p_gender not in ('male', 'female', 'unspecified') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  update public.profiles set first_name = v_first, last_name = v_last, gender = p_gender, email = v_email where id = v_uid;
end $$;

create or replace function public.my_staff_cafes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.current_session_allowed() then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'cafeId', c.id, 'name', c.name, 'assignedBranchId', m.branch_id,
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name), '[]'::jsonb)
                 from public.branches b
                 where b.cafe_id = c.id and b.active and (m.branch_id is null or b.id = m.branch_id))
  ) order by c.name), '[]'::jsonb) into v_result
  from public.memberships m join public.cafes c on c.id = m.cafe_id
  where m.user_id = auth.uid() and m.role = 'barista' and m.status = 'active' and c.status = 'active';
  return v_result;
end $$;

create or replace function public.next_cafe_slug(p_name text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_base text := trim(both '-' from left(public.slugify(p_name), 50)); v_slug text; n int := 2;
begin
  if char_length(v_base) < 2 then v_base := 'cafe-' || left(replace(p_id::text, '-', ''), 6); end if;
  v_slug := v_base;
  while exists (select 1 from public.cafes where slug = v_slug and id <> p_id) loop
    v_slug := left(v_base, 60 - char_length(n::text) - 1) || '-' || n;
    n := n + 1;
  end loop;
  return v_slug;
end $$;

create or replace function public.next_branch_slug(p_cafe uuid, p_name text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_base text := trim(both '-' from left(public.slugify(p_name), 50)); v_slug text; n int := 2;
begin
  if char_length(v_base) < 2 then v_base := 'branch-' || left(replace(p_id::text, '-', ''), 6); end if;
  v_slug := v_base;
  while exists (select 1 from public.branches where cafe_id = p_cafe and slug = v_slug and id <> p_id) loop
    v_slug := left(v_base, 60 - char_length(n::text) - 1) || '-' || n;
    n := n + 1;
  end loop;
  return v_slug;
end $$;

-- A client retry carries the same request UUID. The row and cafe/branch writes
-- are in one DB transaction; an aborted call leaves no half-created cafe.
create table public.cafe_setup_requests (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id, request_id)
);
alter table public.cafe_setup_requests enable row level security;
revoke all on public.cafe_setup_requests from anon, authenticated;

create or replace function public.create_cafe_with_branch(
  p_request_id uuid, p_first text, p_last text, p_name text, p_instagram text,
  p_registration text, p_branch text, p_address text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cafe uuid; v_existing uuid;
  v_first text := btrim(coalesce(p_first, '')); v_last text := btrim(coalesce(p_last, ''));
  v_name text := btrim(coalesce(p_name, '')); v_branch text := btrim(coalesce(p_branch, ''));
  v_instagram text := btrim(coalesce(p_instagram, '')); v_registration text := btrim(coalesce(p_registration, ''));
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
begin
  if v_uid is null or not public.current_session_allowed() then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'invalid_request_id' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cafe-setup:'||v_uid::text||':'||p_request_id::text, 0));
  select cafe_id into v_existing from public.cafe_setup_requests where owner_id = v_uid and request_id = p_request_id;
  if v_existing is not null then return v_existing; end if;
  if char_length(v_first) not between 1 and 40 or char_length(v_last) not between 1 and 40
    or char_length(v_name) not between 2 and 80 or char_length(v_branch) not between 1 and 80
    or char_length(coalesce(v_address, '')) > 200 or char_length(v_registration) > 60
    or char_length(v_instagram) > 200 or (v_instagram <> '' and v_instagram !~* '^https?://(www\.)?instagram\.com/[a-z0-9._]+/?$') then
    raise exception 'invalid_cafe_details' using errcode = '22023';
  end if;
  -- The owner/staff invite workflow is phone-based. Email-only Auth accounts
  -- cannot silently create an owner account that has no phone identity.
  if not exists (select 1 from public.profiles where id=v_uid and phone is not null) then
    raise exception 'owner_phone_required' using errcode = '22023';
  end if;
  update public.profiles set first_name=v_first,last_name=v_last where id=v_uid;
  insert into public.cafes(owner_id,name,instagram_url,business_registration_no)
    values(v_uid,v_name,nullif(v_instagram,''),nullif(v_registration,'')) returning id into v_cafe;
  insert into public.branches(cafe_id,name,address) values(v_cafe,v_branch,v_address);
  insert into public.cafe_setup_requests(owner_id,request_id,cafe_id) values(v_uid,p_request_id,v_cafe);
  return v_cafe;
end $$;

revoke all on function public.create_cafe_with_branch(uuid,text,text,text,text,text,text,text) from public;
revoke all on function public.join_cafe(uuid) from public;
revoke all on function public.complete_profile(text,text,text,text) from public;
revoke all on function public.my_staff_cafes() from public;
grant execute on function public.create_cafe_with_branch(uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.join_cafe(uuid) to authenticated;
grant execute on function public.complete_profile(text,text,text,text) to authenticated;
grant execute on function public.my_staff_cafes() to authenticated;

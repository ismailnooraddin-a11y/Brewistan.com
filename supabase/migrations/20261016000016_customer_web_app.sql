-- Customer web app (brewistan.com):
--  1. Customer profile: gender (required in the app) and optional email.
--  2. Permanent, human-readable café and branch addresses for QR codes:
--     brewistan.com/c/<cafe-slug>/<branch-slug>. Slugs are assigned once and never
--     change, so printed QR codes keep working.
--  3. public_cafe_page: what a QR landing page shows (public information only).
--  4. join_cafe: a signed-in customer gets that café's card. Never awards a stamp.
--  5. complete_profile: validated first-time registration.
--  6. my_staff_cafes: cafés and branches a barista may scan for (web scanner).

-- 1. Profile fields
alter table public.profiles add column if not exists gender text
  check (gender in ('male', 'female', 'unspecified'));
alter table public.profiles add column if not exists email text
  check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- 2. Slugs
create or replace function public.slugify(p text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.cafes add column if not exists slug text;
alter table public.branches add column if not exists slug text;

create or replace function public.next_cafe_slug(p_name text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_base text := left(public.slugify(p_name), 50); v_slug text; n int := 2;
begin
  -- Names in Arabic or Kurdish script have no Latin letters: use a short stable id instead.
  if char_length(v_base) < 2 then v_base := 'cafe-' || left(replace(p_id::text, '-', ''), 6); end if;
  v_slug := v_base;
  while exists (select 1 from public.cafes where slug = v_slug and id <> p_id) loop
    v_slug := v_base || '-' || n; n := n + 1;
  end loop;
  return v_slug;
end $$;

create or replace function public.next_branch_slug(p_cafe uuid, p_name text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_base text := left(public.slugify(p_name), 50); v_slug text; n int := 2;
begin
  if char_length(v_base) < 2 then v_base := 'branch-' || left(replace(p_id::text, '-', ''), 6); end if;
  v_slug := v_base;
  while exists (select 1 from public.branches where cafe_id = p_cafe and slug = v_slug and id <> p_id) loop
    v_slug := v_base || '-' || n; n := n + 1;
  end loop;
  return v_slug;
end $$;

-- Backfill one row at a time so each new slug sees the ones assigned before it.
do $$
declare r record;
begin
  for r in select id, name from public.cafes where slug is null order by created_at, id loop
    update public.cafes set slug = public.next_cafe_slug(r.name, r.id) where id = r.id;
  end loop;
  for r in select id, cafe_id, name from public.branches where slug is null order by created_at, id loop
    update public.branches set slug = public.next_branch_slug(r.cafe_id, r.name, r.id) where id = r.id;
  end loop;
end $$;

alter table public.cafes add constraint cafes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60);
alter table public.branches add constraint branches_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60);
create unique index if not exists cafes_slug_key on public.cafes (slug);
create unique index if not exists branches_cafe_slug_key on public.branches (cafe_id, slug);

-- Assign on insert; never change afterwards (printed QR codes depend on them).
create or replace function public.cafe_slug_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null then new.slug := public.next_cafe_slug(new.name, new.id); end if;
  elsif new.slug is distinct from old.slug and not public.is_privileged() then
    new.slug := old.slug;
  end if;
  return new;
end $$;

create or replace function public.branch_slug_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null then new.slug := public.next_branch_slug(new.cafe_id, new.name, new.id); end if;
  elsif new.slug is distinct from old.slug and not public.is_privileged() then
    new.slug := old.slug;
  end if;
  return new;
end $$;
drop trigger if exists cafes_slug_guard on public.cafes;
create trigger cafes_slug_guard before insert or update on public.cafes for each row execute function public.cafe_slug_guard();
drop trigger if exists branches_slug_guard on public.branches;
create trigger branches_slug_guard before insert or update on public.branches for each row execute function public.branch_slug_guard();
alter table public.cafes alter column slug set not null;
alter table public.branches alter column slug set not null;

-- 3. Public landing page data (anyone with the QR may see this; nothing personal).
create or replace function public.public_cafe_page(p_cafe_slug text, p_branch_slug text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'cafeId', c.id, 'cafeSlug', c.slug, 'name', c.name, 'tier', c.tier,
    'brand', case when c.tier = 'classic' then '{}'::jsonb else c.brand end,
    'logoPath', case when c.tier = 'classic' then null else c.logo_path end,
    'branchId', b.id, 'branchName', b.name,
    'stampsRequired', coalesce(cp.stamps_required, 8),
    'rewardLabel', coalesce(cp.reward_label, '{"en":"Free Coffee"}'::jsonb))
  from public.cafes c
  left join public.branches b on b.cafe_id = c.id and b.slug = p_branch_slug and b.active
  left join public.campaigns cp on cp.cafe_id = c.id and cp.active
  where c.slug = p_cafe_slug and c.status = 'active'
  limit 1;
$$;

-- 4. Join a café: creates the customer's card with zero stamps. Idempotent.
create or replace function public.join_cafe(p_cafe uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and first_name is not null and last_name is not null) then
    raise exception 'profile_incomplete' using errcode = '22023';
  end if;
  if not exists (select 1 from public.cafes where id = p_cafe and status = 'active') then
    raise exception 'cafe_unavailable' using errcode = '22023';
  end if;
  insert into public.user_cafe_progress (user_id, cafe_id) values (v_uid, p_cafe)
  on conflict (user_id, cafe_id) do update set archived = false where public.user_cafe_progress.archived;
  return jsonb_build_object('cafeId', p_cafe, 'joined', true);
end $$;

-- 5. First-time registration details.
create or replace function public.complete_profile(p_first text, p_last text, p_gender text, p_email text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_first text := btrim(coalesce(p_first, '')); v_last text := btrim(coalesce(p_last, ''));
        v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
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

-- 6. Where this barista may scan.
create or replace function public.my_staff_cafes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cafeId', c.id, 'name', c.name, 'assignedBranchId', m.branch_id,
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name), '[]'::jsonb)
                 from public.branches b
                 where b.cafe_id = c.id and b.active and (m.branch_id is null or b.id = m.branch_id))
  ) order by c.name), '[]'::jsonb)
  from public.memberships m join public.cafes c on c.id = m.cafe_id
  where m.user_id = auth.uid() and m.role = 'barista' and m.status = 'active' and c.status = 'active';
$$;

revoke all on function public.public_cafe_page(text, text) from public;
revoke all on function public.join_cafe(uuid) from public;
revoke all on function public.complete_profile(text, text, text, text) from public;
revoke all on function public.my_staff_cafes() from public;
revoke all on function public.next_cafe_slug(text, uuid) from public;
revoke all on function public.next_branch_slug(uuid, text, uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.public_cafe_page(text, text) to anon, authenticated;
    grant execute on function public.join_cafe(uuid) to authenticated;
    grant execute on function public.complete_profile(text, text, text, text) to authenticated;
    grant execute on function public.my_staff_cafes() to authenticated;
  end if;
end $$;

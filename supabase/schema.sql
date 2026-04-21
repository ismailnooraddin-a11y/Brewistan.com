-- ============================================================
--  Brewistan — database schema
--  Run this in the Supabase SQL Editor.
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.merchants (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.cafes (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references public.merchants (id) on delete cascade,
  name         text not null,
  city         text,
  created_at   timestamptz not null default now()
);

create table if not exists public.rewards (
  id              uuid primary key default gen_random_uuid(),
  cafe_id         uuid not null references public.cafes (id) on delete cascade,
  stamps_required int  not null default 8,
  reward_text     text not null default 'Free coffee',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists cafes_merchant_id_idx   on public.cafes (merchant_id);
create index if not exists rewards_cafe_id_idx     on public.rewards (cafe_id);

-- ---------- Trigger: on new auth.users, create merchant + cafe + default reward ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_cafe_id uuid;
begin
  insert into public.merchants (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );

  insert into public.cafes (merchant_id, name, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'cafe_name', 'My café'),
    coalesce(new.raw_user_meta_data ->> 'city', '')
  )
  returning id into new_cafe_id;

  insert into public.rewards (cafe_id)
  values (new_cafe_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row-level security ----------

alter table public.merchants enable row level security;
alter table public.cafes     enable row level security;
alter table public.rewards   enable row level security;

-- Merchants: owner-only access
drop policy if exists "merchants_select_own"  on public.merchants;
drop policy if exists "merchants_update_own"  on public.merchants;

create policy "merchants_select_own"
  on public.merchants for select
  using (auth.uid() = id);

create policy "merchants_update_own"
  on public.merchants for update
  using (auth.uid() = id);

-- Cafes: owner-only access
drop policy if exists "cafes_select_own"  on public.cafes;
drop policy if exists "cafes_insert_own"  on public.cafes;
drop policy if exists "cafes_update_own"  on public.cafes;
drop policy if exists "cafes_delete_own"  on public.cafes;

create policy "cafes_select_own"
  on public.cafes for select
  using (auth.uid() = merchant_id);

create policy "cafes_insert_own"
  on public.cafes for insert
  with check (auth.uid() = merchant_id);

create policy "cafes_update_own"
  on public.cafes for update
  using (auth.uid() = merchant_id);

create policy "cafes_delete_own"
  on public.cafes for delete
  using (auth.uid() = merchant_id);

-- Rewards: owner-only (via cafe → merchant)
drop policy if exists "rewards_select_own"  on public.rewards;
drop policy if exists "rewards_insert_own"  on public.rewards;
drop policy if exists "rewards_update_own"  on public.rewards;
drop policy if exists "rewards_delete_own"  on public.rewards;

create policy "rewards_select_own"
  on public.rewards for select
  using (
    exists (
      select 1 from public.cafes c
      where c.id = rewards.cafe_id and c.merchant_id = auth.uid()
    )
  );

create policy "rewards_insert_own"
  on public.rewards for insert
  with check (
    exists (
      select 1 from public.cafes c
      where c.id = rewards.cafe_id and c.merchant_id = auth.uid()
    )
  );

create policy "rewards_update_own"
  on public.rewards for update
  using (
    exists (
      select 1 from public.cafes c
      where c.id = rewards.cafe_id and c.merchant_id = auth.uid()
    )
  );

create policy "rewards_delete_own"
  on public.rewards for delete
  using (
    exists (
      select 1 from public.cafes c
      where c.id = rewards.cafe_id and c.merchant_id = auth.uid()
    )
  );

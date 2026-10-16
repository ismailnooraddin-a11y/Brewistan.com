-- Storage buckets for cafe verification photos (private) and branding (public).
-- Object paths always start with the cafe id: "<cafe_id>/<file>".

insert into storage.buckets (id, name, public)
values ('verification', 'verification', false), ('branding', 'branding', true)
on conflict (id) do nothing;

create or replace function public.path_cafe_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy "verification upload by owner" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification' and public.is_cafe_owner(public.path_cafe_id(name)));

create policy "verification read by owner or admin" on storage.objects for select to authenticated
  using (bucket_id = 'verification'
         and (public.is_cafe_owner(public.path_cafe_id(name)) or public.is_admin()));

create policy "branding upload by owner" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_cafe_owner(public.path_cafe_id(name)));

create policy "branding update by owner" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_cafe_owner(public.path_cafe_id(name)));

create policy "branding delete by owner" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_cafe_owner(public.path_cafe_id(name)));

-- Daily reward expiry. The push-dispatch job also calls expire_rewards(), so this
-- is a second safety net when pg_cron is enabled on the project.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('brewistan-expire-rewards', '15 21 * * *', 'select public.expire_rewards()');
exception when others then
  raise notice 'pg_cron not available, skipping schedule: %', sqlerrm;
end $$;

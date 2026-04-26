-- ============================================================================
-- Storage: cafe logos bucket
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cafe-logos', 'cafe-logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Only the cafe owner can upload/update/delete files under `{cafe_id}/...`
create policy "cafe_logos_owner_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cafe-logos'
    and public.is_cafe_owner((split_part(name, '/', 1))::uuid)
  );

create policy "cafe_logos_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'cafe-logos'
    and public.is_cafe_owner((split_part(name, '/', 1))::uuid)
  );

create policy "cafe_logos_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'cafe-logos'
    and public.is_cafe_owner((split_part(name, '/', 1))::uuid)
  );

create policy "cafe_logos_public_read"
  on storage.objects for select to public
  using (bucket_id = 'cafe-logos');

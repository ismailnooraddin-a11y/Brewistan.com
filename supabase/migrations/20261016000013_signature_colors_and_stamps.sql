-- Product change: Signature cafes may now choose their own two card colours
-- (previously only Bespoke could; Signature was locked to picking a template).
-- Every paid tier may also choose how a collected stamp looks (cup, dot, or
-- bean); Classic always uses the default (cup) and cannot change it.
-- Everything else in these two guards is unchanged from migration 12.

create or replace function public.cafes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged() then
    new.status := old.status;
    new.approved_at := old.approved_at;
    new.rejection_reason := old.rejection_reason;
    new.rejected_at := old.rejected_at;
    new.owner_id := old.owner_id;
    new.verification_code := old.verification_code;
    new.tier := old.tier;
    new.created_at := old.created_at;
    -- Custom logos remain Signature and Bespoke only.
    if old.tier = 'classic' then
      new.logo_path := old.logo_path;
    end if;
    -- Classic cannot set any branding at all. Signature and Bespoke may both
    -- set a template, a stamp style, and their own primary/accent colours;
    -- cafes_content_guard (below) validates the actual field values.
    if old.tier = 'classic' then
      new.brand := old.brand;
    end if;
  end if;
  return new;
end $$;

create or replace function public.cafes_content_guard() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and not public.is_privileged() then new.brand := '{}'::jsonb; new.logo_path := null; end if;
 if new.logo_path is not null and split_part(new.logo_path,'/',1) <> new.id::text then
   raise exception 'logo_tenant_mismatch' using errcode='22023';
 end if;
 if new.verification_photo_path is not null and split_part(new.verification_photo_path,'/',1) <> new.id::text then
   raise exception 'verification_tenant_mismatch' using errcode='22023';
 end if;
 if jsonb_typeof(new.brand) <> 'object' or (new.brand ? 'template' and coalesce(new.brand->>'template','') !~ '^[a-z][a-z0-9_]{1,23}$') then
   raise exception 'invalid_brand' using errcode='22023';
 end if;
 -- Like the template id, this only checks the shape of a stamp style id (lowercase,
 -- digits, underscore). Which ids actually exist is decided by the apps
 -- (apps/mobile/lib/widgets/puzzle.dart, apps/web/lib/card-designs.ts), so a new
 -- stamp style never needs a migration.
 if new.brand ? 'stamp' and coalesce(new.brand->>'stamp','') !~ '^[a-z][a-z0-9_]{1,23}$' then
   raise exception 'invalid_stamp_style' using errcode='22023';
 end if;
 if (new.brand ? 'primary' and new.brand->>'primary' !~ '^#[0-9a-fA-F]{6}$') or
    (new.brand ? 'accent' and new.brand->>'accent' !~ '^#[0-9a-fA-F]{6}$') then
   raise exception 'invalid_brand_color' using errcode='22023';
 end if;
 return new;
end $$;

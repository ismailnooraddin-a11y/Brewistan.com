-- Card designs are defined in the apps (apps/mobile/lib/cards/card_designs.dart and
-- apps/web/lib/card-designs.ts). The database only checks that the id is well formed, so a
-- new design never needs a migration. Unknown ids fall back to the default design in the apps.
-- Everything else in this guard is unchanged from migration 03.
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
 if (new.brand ? 'primary' and new.brand->>'primary' !~ '^#[0-9a-fA-F]{6}$') or
    (new.brand ? 'accent' and new.brand->>'accent' !~ '^#[0-9a-fA-F]{6}$') then
   raise exception 'invalid_brand_color' using errcode='22023';
 end if;
 return new;
end $$;

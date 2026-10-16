import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, Notice } from '@/components/ui';
import { BrandingForm } from './BrandingForm';

export default async function BrandingPage() {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const logoUrl = cafe.logo_path ? supabase.storage.from('branding').getPublicUrl(cafe.logo_path).data.publicUrl : null;
  return (
    <>
      <PageHeader title={t('branding.title')} description="How your card looks in the customer app." />
      {cafe.tier === 'classic' ? (
        <Notice title="Classic plan">
          Classic cards use the standard layout with your cafe name. Upgrade to Signature for your logo and premium dark templates,
          or Bespoke for a fully custom card designed by our team.
        </Notice>
      ) : (
        <BrandingForm cafeId={cafe.id} tier={cafe.tier} brand={cafe.brand ?? {}} logoUrl={logoUrl} />
      )}
    </>
  );
}

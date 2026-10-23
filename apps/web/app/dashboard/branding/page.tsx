import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader } from '@/components/ui';
import { BrandingForm } from './BrandingForm';
import { ClassicCardForm } from './ClassicCardForm';

export default async function BrandingPage() {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const logoUrl = cafe.logo_path ? supabase.storage.from('branding').getPublicUrl(cafe.logo_path).data.publicUrl : null;
  return (
    <>
      <PageHeader title={t('nav.branding')} description="How your card looks in the customer app." />
      {cafe.tier === 'classic' ? (
        <ClassicCardForm key={cafe.id} cafeId={cafe.id} cafeName={cafe.name} />
      ) : (
        <BrandingForm key={cafe.id} cafeId={cafe.id} cafeName={cafe.name} tier={cafe.tier} brand={cafe.brand ?? {}} logoUrl={logoUrl} />
      )}
    </>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CafeCardPreview } from '@/components/CafeCardPreview';
import { cardLook, logoUrl } from '@/lib/customer/look';
import { pickLabel } from '@/lib/customer/strings';
import { customerClient } from '@/lib/customer/supabase';
import { useCustomerText } from './CustomerProvider';
import { useCustomer } from './useCustomer';
import { PhoneAuth } from './PhoneAuth';
import { ProfileForm } from './ProfileForm';
import { BrandBar } from './BrandBar';

export interface PublicCafePage {
  cafeId: string; cafeSlug: string; name: string; tier: string; brand: Record<string, string> | null;
  logoPath: string | null; branchId: string | null; branchName: string | null;
  stampsRequired: number; rewardLabel: Record<string, string> | null;
}

/**
 * What a customer sees after scanning a café's branch QR. Scanning only opens the card;
 * stamps are recorded only when a barista scans the customer's own code.
 */
export function CafeEntry({ page }: { page: PublicCafePage }) {
  const { t, lang } = useCustomerText();
  const router = useRouter();
  const customer = useCustomer();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const look = cardLook(page.tier, page.brand);
  const reward = pickLabel(page.rewardLabel, lang);

  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.profileComplete || started.current) return;
    started.current = true;
    (async () => {
      const { error: err } = await customerClient().rpc('join_cafe', { p_cafe: page.cafeId });
      if (err) { started.current = false; setError(/cafe_unavailable/.test(err.message) ? t('cafeNotFound') : t('genericError')); return; }
      // Prepare the rotating code in the background; the card page retries if this fails.
      router.replace(`/cards/${page.cafeId}`);
    })();
  }, [customer.status, customer.profileComplete, customer.user, page.cafeId, router, t, lang]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      <BrandBar />
      <div className="mt-6 text-center">
        <div className="text-[13px] cx-muted">{page.branchName ?? t('welcome')}</div>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.01em]">{page.name}</h1>
      </div>
      <div className="mt-6 flex justify-center">
        <CafeCardPreview name={page.name} bg={look.bg} fg={look.fg} logoUrl={page.tier === 'classic' ? null : logoUrl(page.logoPath)} filled={0}
          total={page.stampsRequired} goal={reward} tag={look.tag} footer={t('moreFor', { n: page.stampsRequired, reward })} />
      </div>
      <p className="mt-5 text-center text-[14px] cx-muted">{t('welcomeBody')}</p>

      <section className="cx-surface mt-6 p-5">
        {customer.status === 'loading' && <Spinner label="…" />}
        {customer.status === 'signedOut' && <PhoneAuth onSignedIn={customer.refresh} />}
        {customer.status === 'signedIn' && customer.profileComplete === null && <p className="text-center text-[13px] cx-muted">Unable to check registration while offline. <button className="cx-link" onClick={customer.refresh}>Retry</button></p>}
        {customer.status === 'signedIn' && customer.profileComplete === false && <ProfileForm onDone={customer.refresh} />}
        {customer.status === 'signedIn' && customer.profileComplete === true && !error && <Spinner label={t('openingCard')} />}
        {error && <p role="alert" className="text-center text-[14px] text-[#e8857a]">{error}</p>}
      </section>
    </main>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-3 text-[14px] cx-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#c8a96a]/30 border-t-[#c8a96a]" aria-hidden="true" />
      {label}
    </div>
  );
}

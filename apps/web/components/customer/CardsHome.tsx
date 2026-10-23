'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CafeCardPreview } from '@/components/CafeCardPreview';
import { cardLook } from '@/lib/customer/look';
import { pickLabel } from '@/lib/customer/strings';
import { cachedWallet, clearWalletCache, fetchWallet, type Wallet } from '@/lib/customer/wallet';
import { customerClient } from '@/lib/customer/supabase';
import { forgetDevice } from '@/lib/customer/device';
import { useCustomerText } from './CustomerProvider';
import { useCustomer } from './useCustomer';
import { PhoneAuth } from './PhoneAuth';
import { ProfileForm } from './ProfileForm';
import { BrandBar } from './BrandBar';
import { Spinner } from './CafeEntry';

export function CardsHome() {
  const { t, lang } = useCustomerText();
  const customer = useCustomer();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.user) return;
    const uid = customer.user.id;
    setWallet(cachedWallet(uid));
    fetchWallet(uid).then((w) => { setWallet(w); setOffline(false); }).catch(() => setOffline(true));
  }, [customer.status, customer.user]);

  async function signOut() {
    await customerClient().auth.signOut();
    clearWalletCache(); forgetDevice(); setWallet(null);
  }

  const tier = wallet?.profile?.tier ?? 'bronze';
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      <BrandBar right={customer.status === 'signedIn' ? <button className="cx-link text-[13px]" onClick={signOut}>{t('signOut')}</button> : null} />

      {customer.status === 'loading' && <div className="mt-16"><Spinner label="…" /></div>}
      {customer.status === 'signedOut' && <section className="cx-surface mt-8 p-5"><PhoneAuth onSignedIn={customer.refresh} /></section>}
      {customer.status === 'signedIn' && !customer.profileComplete && <section className="cx-surface mt-8 p-5"><ProfileForm onDone={customer.refresh} /></section>}

      {customer.status === 'signedIn' && customer.profileComplete && (
        <>
          <h1 className="mt-8 text-[28px] font-semibold tracking-[-0.02em]">{t('myCards')}</h1>
          {offline && <p className="mt-2 text-[13px] text-[#d9b56f]">{t('offline')}</p>}
          {!wallet && !offline && <div className="mt-10"><Spinner label="…" /></div>}
          {wallet && wallet.cards.length === 0 && (
            <div className="cx-surface mt-6 p-6 text-center">
              <div className="text-[16px] font-semibold">{t('noCards')}</div>
              <p className="mt-1 text-[14px] cx-muted">{t('noCardsBody')}</p>
            </div>
          )}
          <ul className="mt-6 space-y-4">
            {wallet?.cards.filter((c) => !c.archived).map((c) => {
              const look = cardLook(c.tier, c.brand, tier);
              const reward = pickLabel(c.rewardLabel, lang);
              const ready = c.rewards.length > 0;
              const left = Math.max(0, c.stampsRequired - c.stampsInCurrent);
              return (
                <li key={c.cafeId}>
                  <Link href={`/cards/${c.cafeId}`} className="block rounded-[20px] transition-transform duration-150 active:scale-[0.99]">
                    <CafeCardPreview name={c.name} bg={look.bg} fg={look.fg} logoUrl={c.logoUrl} filled={c.stampsInCurrent}
                      total={c.stampsRequired} goal={reward} tag={look.tag}
                      footer={ready ? t('rewardReady', { reward }) : t('moreFor', { n: left, reward })} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

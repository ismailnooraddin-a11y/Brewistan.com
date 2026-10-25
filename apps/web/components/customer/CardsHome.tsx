'use client';
import { cardCustomerName, cardLastStampAt } from '@/lib/customer/card-presentation';

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
import { AuthEmailSettings } from '@/components/AuthEmailSettings';
import { CafeQrScanner } from './CafeQrScanner';

function readyRewardLabel(c: Wallet['cards'][number], _lang: string) {
  return c.rewards.find((r) => Date.parse(r.expiresAt) > Date.now())?.rewardLabel ?? c.rewardLabel;
}

export function CardsHome() {
  const { t, lang } = useCustomerText();
  const customer = useCustomer();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.user) return;
    const uid = customer.user.id;
    let active = true;
    let running = false;
    setWallet(cachedWallet(uid));
    setOffline(false);
    const reload = async () => {
      if (running || !active) return;
      running = true;
      try {
        const w = await fetchWallet(uid);
        if (active) { setWallet(w); setOffline(false); }
      } catch { if (active) setOffline(true); }
      finally { running = false; }
    };
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void reload();
    };
    void reload();
    const timer = window.setInterval(refreshVisible, 30_000);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [customer.status, customer.user?.id]);

  async function signOut() {
    await customerClient().auth.signOut({ scope: 'local' });
    clearWalletCache(); forgetDevice(); try { localStorage.removeItem('bw.profile.v1'); } catch {} setWallet(null);
  }

  const tier = wallet?.profile?.tier ?? 'bronze';
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      <BrandBar right={customer.status === 'signedIn' ? <button className="cx-link text-[13px]" onClick={signOut}>{t('signOut')}</button> : null} />

      {customer.status === 'loading' && <div className="mt-16"><Spinner label="…" /></div>}
      {customer.status === 'signedOut' && <section className="cx-surface mt-8 p-5"><PhoneAuth onSignedIn={customer.refresh} /></section>}
      {customer.status === 'signedIn' && customer.profileComplete === null && <section className="cx-surface mt-8 p-5 text-[13px] cx-muted">Could not check your profile. <button onClick={customer.refresh} className="cx-link">Retry</button></section>}
      {customer.status === 'signedIn' && customer.profileComplete === false && <section className="cx-surface mt-8 p-5"><ProfileForm onDone={customer.refresh} /></section>}

      {customer.status === 'signedIn' && customer.profileComplete === true && (
        <>
          <div className="mt-8 flex items-end justify-between gap-3"><h1 className="text-[29px] font-semibold tracking-[-0.045em]">{t('myCards')}</h1><span className="pb-1 text-[12px] cx-muted tabular-nums">{wallet?.cards.filter((c) => !c.archived).length ?? 0}</span></div>
          {offline && <p className="mt-2 text-[13px] text-[#d9b56f]">{t('offline')}</p>}
          <div className="mt-4"><CafeQrScanner /></div>
          {!wallet && !offline && <div className="mt-10"><Spinner label="…" /></div>}
          {wallet && wallet.cards.every((c) => c.archived) && (
            <div className="cx-surface mt-6 p-6 text-center">
              <div className="text-[16px] font-semibold">{t('noCards')}</div>
              <p className="mt-1 text-[14px] cx-muted">{t('noCardsBody')}</p>
            </div>
          )}
          <ul className="mt-5 space-y-[11px]">
            {wallet?.cards.filter((c) => !c.archived).map((c) => {
              const look = cardLook(c.tier, c.brand, tier);
              const reward = pickLabel(readyRewardLabel(c, lang), lang);
              const ready = c.rewards.some((r) => Date.parse(r.expiresAt) > Date.now());
              const left = Math.max(0, c.stampsRequired - c.stampsInCurrent);
              return (
                <li key={c.cafeId}>
                  <Link href={`/cards/${c.cafeId}`} className="block rounded-[19px] transition-transform duration-150 hover:brightness-[1.04] active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c8a96a]">
                    <CafeCardPreview name={c.name} bg={look.bg} fg={look.fg} logoUrl={c.tier === 'classic' ? null : c.logoUrl} filled={c.stampsInCurrent}
                      total={c.stampsRequired} goal={reward} tag={look.tag}
                      footer={ready ? t('rewardReady', { reward }) : t('moreFor', { n: left, reward })} density="full"  customerName={cardCustomerName(wallet?.profile)} lastStampAt={cardLastStampAt(c)} locale={lang} stampStyle={c.tier === 'classic' ? 'cup' : c.brand?.stamp} />
                  </Link>
                </li>
              );
            })}
          </ul>
          <details className="mt-7"><summary className="cursor-pointer text-[12px] cx-muted">{t('accountSettings')}</summary><AuthEmailSettings customer currentEmail={customer.user?.email} /></details>
        </>
      )}
    </main>
  );
}

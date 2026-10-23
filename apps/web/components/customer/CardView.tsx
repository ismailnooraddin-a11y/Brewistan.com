'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CafeCardPreview } from '@/components/CafeCardPreview';
import { cardLook } from '@/lib/customer/look';
import { pickLabel } from '@/lib/customer/strings';
import { cachedWallet, fetchWallet, type Wallet } from '@/lib/customer/wallet';
import { currentQr, ensureDevice, serverNow } from '@/lib/customer/device';
import { useCustomerText } from './CustomerProvider';
import { useCustomer } from './useCustomer';
import { BrandBar } from './BrandBar';
import { Spinner } from './CafeEntry';
import { PhoneAuth } from './PhoneAuth';

/** One café card with the code the barista scans. Refreshes stamps while open. */
export function CardView({ cafeId }: { cafeId: string }) {
  const { t, lang } = useCustomerText();
  const customer = useCustomer();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [offline, setOffline] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const polls = useRef(0);

  const reload = useCallback(async (uid: string) => {
    try { setWallet(await fetchWallet(uid)); setOffline(false); } catch { setOffline(true); }
  }, []);

  // Wallet: cached first, then the server; refresh every 10 s for 5 minutes while visible.
  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.user) return;
    const uid = customer.user.id;
    setWallet(cachedWallet(uid));
    reload(uid);
    polls.current = 0;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && polls.current++ < 30) reload(uid);
    }, 10_000);
    return () => clearInterval(id);
  }, [customer.status, customer.user, reload]);

  // Rotating code: re-sign every 30 s window.
  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const draw = async () => {
      try {
        await ensureDevice(customer.user!.id, lang);
        const qr = await currentQr();
        if (!qr) throw new Error('no_cert');
        const url = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1, width: 560, color: { dark: '#151311', light: '#ffffff' } });
        if (!cancelled) { setQrImage(url); setQrError(false); }
      } catch {
        if (!cancelled) setQrError(true);
      }
      const msToNext = 30_000 - (serverNow() % 30_000) + 200;
      timer = setTimeout(draw, Math.min(msToNext, 30_000));
    };
    draw();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [customer.status, customer.user, lang]);

  const card = wallet?.cards.find((c) => c.cafeId === cafeId);
  const tier = wallet?.profile?.tier ?? 'bronze';

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      <BrandBar right={<Link href="/cards" className="cx-link text-[13px]">{t('myCards')}</Link>} />
      {customer.status === 'loading' && <div className="mt-16"><Spinner label="…" /></div>}
      {customer.status === 'signedOut' && <section className="cx-surface mt-8 p-5"><PhoneAuth onSignedIn={customer.refresh} /></section>}
      {customer.status === 'signedIn' && !card && <div className="mt-16"><Spinner label={t('openingCard')} /></div>}
      {customer.status === 'signedIn' && card && (
        <CardDisplay
          name={card.name} logo={card.logoUrl} look={cardLook(card.tier, card.brand, tier)}
          filled={card.stampsInCurrent} total={card.stampsRequired} reward={pickLabel(card.rewardLabel, lang)}
          rewardReady={card.rewards.length > 0} qrImage={qrImage} qrError={qrError} offline={offline}
        />
      )}
    </main>
  );
}

/** Presentational: card, reward notice and the scannable code. */
export function CardDisplay({ name, logo, look, filled, total, reward, rewardReady, qrImage, qrError, offline }: {
  name: string; logo: string | null; look: { bg: string; fg: string; tag: string }; filled: number; total: number;
  reward: string; rewardReady: boolean; qrImage: string | null; qrError: boolean; offline: boolean;
}) {
  const { t } = useCustomerText();
  const left = Math.max(0, total - filled);
  return (
    <div className="mt-6 space-y-5">
      <CafeCardPreview name={name} bg={look.bg} fg={look.fg} logoUrl={logo} filled={filled} total={total} goal={reward} tag={look.tag}
        footer={rewardReady ? t('rewardReady', { reward }) : t('moreFor', { n: left, reward })} />
      {offline && <p className="text-center text-[13px] text-[#d9b56f]">{t('offline')}</p>}
      {rewardReady && (
        <div className="rounded-2xl border border-[#c8a96a]/40 bg-[#c8a96a]/10 p-4 text-center">
          <div className="text-[15px] font-semibold text-[#e7cf98]">{t('rewardReadyTitle')}</div>
          <div className="mt-0.5 text-[13.5px] cx-muted">{t('rewardReadyBody', { reward })}</div>
        </div>
      )}
      <section className="cx-surface flex flex-col items-center p-5">
        <div className="text-[15px] font-semibold">{t('showToBarista')}</div>
        <div className="mt-4 grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl bg-white p-3">
          {qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt={t('showToBarista')} className="h-full w-full [image-rendering:pixelated]" />
          ) : (
            <span className="px-6 text-center text-[13px] text-[#6f665c]">{qrError ? t('genericError') : t('preparingCode')}</span>
          )}
        </div>
        <p className="mt-3 text-center text-[12.5px] cx-muted">{t('codeRefreshes')}</p>
      </section>
    </div>
  );
}

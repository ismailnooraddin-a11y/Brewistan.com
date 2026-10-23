'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** The card in the installed PWA. A fresh QR remains a separately readable block. */
export function CardView({ cafeId }: { cafeId: string }) {
  const { t, lang } = useCustomerText();
  const customer = useCustomer();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [offline, setOffline] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [clock, setClock] = useState(Date.now());

  const reload = useCallback(async (uid: string) => {
    try { setWallet(await fetchWallet(uid)); setOffline(false); }
    catch { setOffline(true); }
    finally { setResolved(true); }
  }, []);

  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.user) return;
    const uid = customer.user.id;
    setWallet(cachedWallet(uid));
    setResolved(false);
    void reload(uid);
    const refreshIfVisible = () => {
      setClock(Date.now());
      if (document.visibilityState === 'visible' && navigator.onLine) void reload(uid);
    };
    // Continue refreshing while the card is being used at the counter; never
    // silently stop after five minutes. Focus/reconnect triggers a fresh read.
    const id = window.setInterval(refreshIfVisible, 15_000);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [customer.status, customer.user?.id, reload]);

  const card = wallet?.cards.find((c) => c.cafeId === cafeId && !c.archived);
  const earned = card?.rewards.find((r) => Date.parse(r.expiresAt) > clock);
  const voucher = earned?.voucher || '0';

  // QR belongs to this user/cafe/reward. A failed redraw must never display a
  // previous voucher or an expired certificate as though it were current.
  useEffect(() => {
    if (customer.status !== 'signedIn' || !customer.user || !card) { setQrImage(null); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const draw = async () => {
      if (!cancelled) { setQrImage(null); setQrError(false); }
      try {
        await ensureDevice(customer.user!.id, lang);
        const qr = await currentQr(voucher);
        if (!qr) throw new Error('no_valid_certificate');
        const url = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1, width: 560,
          color: { dark: '#151311', light: '#ffffff' } });
        if (!cancelled) { setQrImage(url); setQrError(false); }
      } catch {
        if (!cancelled) { setQrImage(null); setQrError(true); }
      }
      const msToNext = 30_000 - (serverNow() % 30_000) + 200;
      if (!cancelled) timer = setTimeout(draw, Math.min(msToNext, 30_000));
    };
    void draw();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [customer.status, customer.user?.id, lang, cafeId, !!card, voucher]);

  const tier = wallet?.profile?.tier ?? 'bronze';
  const label = useMemo(() => earned?.rewardLabel ?? card?.rewardLabel ?? null, [earned?.rewardLabel, card?.rewardLabel]);
  const reward = pickLabel(label, lang);

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      <BrandBar right={<Link href="/cards" className="cx-link text-[13px]">{t('myCards')}</Link>} />
      {customer.status === 'loading' && <div className="mt-16"><Spinner label="…" /></div>}
      {customer.status === 'signedOut' && <section className="cx-surface mt-8 p-5"><PhoneAuth onSignedIn={customer.refresh} /></section>}
      {customer.status === 'signedIn' && customer.profileComplete === null && <section className="cx-surface mt-8 p-5 text-sm cx-muted">Can’t check your account right now. <button className="cx-link" onClick={customer.refresh}>Retry</button></section>}
      {customer.status === 'signedIn' && !card && !resolved && <div className="mt-16"><Spinner label={t('openingCard')} /></div>}
      {customer.status === 'signedIn' && !card && resolved && <section className="cx-surface mt-8 p-5 text-center text-sm cx-muted">{offline ? t('offline') : t('noCardsBody')} <button className="cx-link ms-2" onClick={() => customer.user && reload(customer.user.id)}>Retry</button></section>}
      {customer.status === 'signedIn' && card && (
        <CardDisplay name={card.name} logo={card.tier === 'classic' ? null : card.logoUrl} look={cardLook(card.tier, card.brand, tier)}
          filled={card.stampsInCurrent} total={card.stampsRequired} reward={reward}
          rewardReady={!!earned} qrImage={qrImage} qrError={qrError} offline={offline} />
      )}
    </main>
  );
}

/** The full PWA card and its independently scannable, rotating customer QR. */
export function CardDisplay({ name, logo, look, filled, total, reward, rewardReady, qrImage, qrError, offline }: {
  name: string; logo: string | null; look: { bg: string; fg: string; tag: string }; filled: number; total: number;
  reward: string; rewardReady: boolean; qrImage: string | null; qrError: boolean; offline: boolean;
}) {
  const { t } = useCustomerText();
  const left = Math.max(0, total - filled);
  return (
    <div className="mt-6 space-y-4">
      <CafeCardPreview name={name} bg={look.bg} fg={look.fg} logoUrl={logo} filled={filled} total={total} goal={reward} tag={look.tag}
        footer={rewardReady ? t('rewardReady', { reward }) : t('moreFor', { n: left, reward })} />
      {offline && <p className="text-center text-[13px] text-[#d9b56f]">{t('offline')}</p>}
      {rewardReady && (
        <div className="rounded-2xl border border-[#c8a96a]/30 bg-[#c8a96a]/[0.07] px-4 py-3 text-center">
          <div className="text-[14px] font-semibold text-[#e7cf98]">{t('rewardReadyTitle')}</div>
          <div className="mt-1 text-[12.5px] cx-muted">{t('rewardReadyBody', { reward })}</div>
        </div>
      )}
      <section className="cx-surface flex flex-col items-center p-5">
        <div className="text-[14px] font-semibold">{t('showToBarista')}</div>
        <div className="mt-3 grid aspect-square w-full max-w-[266px] place-items-center rounded-xl bg-white p-3">
          {qrImage && !qrError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt={t('showToBarista')} className="h-full w-full [image-rendering:pixelated]" />
          ) : <span className="px-6 text-center text-[13px] text-[#6f665c]">{qrError ? t('genericError') : t('preparingCode')}</span>}
        </div>
        <p className="mt-3 text-center text-[12px] cx-muted">{t('codeRefreshes')}</p>
      </section>
    </div>
  );
}

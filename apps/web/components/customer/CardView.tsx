'use client';
import { CustomerCardPage } from './CustomerCardPage';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CafeCardPreview } from '@/components/CafeCardPreview';
import { cardLook } from '@/lib/customer/look';
import { pickLabel } from '@/lib/customer/strings';
import { isNanaSceneCafe, shouldShowNanaScene } from '@/lib/customer/nana-scene';
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
  const [scenePreview, setScenePreview] = useState(false);

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
  const nanaScene = !!card && shouldShowNanaScene(card.cafeId, card.tier, scenePreview);
  const showTestSwitch = !!card && isNanaSceneCafe(card.cafeId) && card.tier === 'signature';

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

  return (<CustomerCardPage cafeId={cafeId} customer={customer} wallet={wallet}
      qrImage={qrImage} qrError={qrError} offline={offline} resolved={resolved}
      onRetry={() => { if (customer.user) void reload(customer.user.id); }} />);
}

/** The full PWA card and its independently scannable, rotating customer QR. */
export function CardDisplay({ name, logo, look, filled, total, reward, rewardReady, qrImage, qrError, offline, sceneActive = false }: {
  name: string; logo: string | null; look: { bg: string; fg: string; tag: string }; filled: number; total: number;
  reward: string; rewardReady: boolean; qrImage: string | null; qrError: boolean; offline: boolean; sceneActive?: boolean;
}) {
  const { t } = useCustomerText();
  const left = Math.max(0, total - filled);
  return (
    <div className="mt-6 space-y-4">
      <div className={sceneActive ? 'nana-scene-card' : undefined}>
        <CafeCardPreview name={name} bg={look.bg} fg={look.fg} logoUrl={logo} filled={filled} total={total} goal={reward} tag={look.tag}
          footer={rewardReady ? t('rewardReady', { reward }) : t('moreFor', { n: left, reward })} />
      </div>
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

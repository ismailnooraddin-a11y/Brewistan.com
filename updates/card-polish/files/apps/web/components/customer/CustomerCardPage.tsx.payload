'use client';
import Link from 'next/link';
import { CafeCardPreview } from '@/components/CafeCardPreview';
import { cardLook } from '@/lib/customer/look';
import { cardCustomerName, cardLastStampAt, cardSceneUrl } from '@/lib/customer/card-presentation';
import { pickLabel } from '@/lib/customer/strings';
import type { Wallet } from '@/lib/customer/wallet';
import type { useCustomer } from './useCustomer';
import { useCustomerText } from './CustomerProvider';
import { BrandBar } from './BrandBar';
import { PhoneAuth } from './PhoneAuth';
import { ProfileForm } from './ProfileForm';
import { Spinner } from './CafeEntry';
import styles from './CustomerCardPage.module.css';

interface Props {
  cafeId: string;
  customer: ReturnType<typeof useCustomer>;
  wallet: Wallet | null;
  qrImage: string | null;
  qrError: unknown;
  offline: boolean;
  resolved: boolean;
  onRetry: () => void | Promise<void>;
}

/** Presentation shell only. CardView retains its existing session, QR and refresh logic. */
export function CustomerCardPage({ cafeId, customer, wallet, qrImage, qrError, offline, resolved, onRetry }: Props) {
  const { t, lang } = useCustomerText();
  const card = customer.status === 'signedIn' ? wallet?.cards.find(c => c.cafeId === cafeId && !c.archived) : undefined;
  const earned = card?.rewards.find(r => Date.parse(r.expiresAt) > Date.now());
  const reward = pickLabel(earned?.rewardLabel ?? card?.rewardLabel ?? null, lang);
  const look = card ? cardLook(card.tier, card.brand, wallet?.profile?.tier ?? 'bronze') : null;
  const sceneUrl = card ? cardSceneUrl(card.cafeId, card.tier, card.brand, process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
  return (
    <div className={styles.page} data-card-page="permanent" data-scene={sceneUrl ? 'image' : 'none'}>
      <div className={styles.backdrop} aria-hidden="true">
        {sceneUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={sceneUrl} src={sceneUrl} alt="" className={styles.scene} fetchPriority="high" decoding="async"
            onError={event => { event.currentTarget.style.display = 'none'; }} />
        )}
        {sceneUrl && <div className={styles.shade} />}
      </div>
      <main className={styles.content}>
        <div className={sceneUrl ? styles.glassHeader : undefined}>
          <BrandBar right={<Link href="/cards" className="cx-link text-[13px]">{t('myCards')}</Link>} />
        </div>
        {customer.status === 'loading' && <div className="mt-16"><Spinner label="..." /></div>}
        {customer.status === 'signedOut' && <section className="cx-surface mt-8 p-5"><PhoneAuth onSignedIn={customer.refresh} /></section>}
        {customer.status === 'signedIn' && customer.profileComplete === false && <section className="cx-surface mt-8 p-5"><ProfileForm onDone={customer.refresh} /></section>}
        {customer.status === 'signedIn' && !card && !resolved && <div className="mt-16"><Spinner label={t('openingCard')} /></div>}
        {customer.status === 'signedIn' && !card && resolved && (
          <section className="cx-surface mt-8 p-5 text-center text-sm cx-muted">
            {offline ? t('offline') : t('noCardsBody')}
            <button className="cx-link ms-2" onClick={() => void onRetry()}>{t('cameraRetry')}</button>
          </section>
        )}
        {card && look && (
          <div className={styles.cardStack}>
            <CafeCardPreview name={card.name} bg={look.bg} fg={look.fg} logoUrl={card.tier === 'classic' ? null : card.logoUrl}
              filled={card.stampsInCurrent} total={card.stampsRequired} goal={reward} tag={look.tag}
              footer={earned ? t('rewardReady', { reward }) : t('moreFor', { n: Math.max(0, card.stampsRequired - card.stampsInCurrent), reward })}
              density="full" customerName={cardCustomerName(wallet?.profile)} lastStampAt={cardLastStampAt(card)}
              locale={lang} stampStyle={card.tier === 'classic' ? 'cup' : card.brand?.stamp} />
            {offline && <p className={styles.notice}>{t('offline')}</p>}
            {earned && <div className={styles.rewardNotice}><strong>{t('rewardReadyTitle')}</strong><p>{t('rewardReadyBody', { reward })}</p></div>}
            <section className={styles.qrPanel} aria-label={t('showToBarista')}>
              <h2>{t('showToBarista')}</h2>
              <div className={styles.qrTile}>
                {qrImage && !qrError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrImage} alt={t('showToBarista')} className={styles.qrImage} />
                ) : <span role="status">{qrError ? t('genericError') : t('preparingCode')}</span>}
              </div>
              <p>{t('codeRefreshes')}</p>
              {!!qrError && <button type="button" className="cx-link text-[13px]" onClick={() => window.location.reload()}>{t('cameraRetry')}</button>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

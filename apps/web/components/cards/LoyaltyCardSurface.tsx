'use client';
import type { CSSProperties } from 'react';
import { cardCopy, cardFooter, cardStampDate, stampLayout } from '@/lib/customer/card-presentation';
import styles from './LoyaltyCardSurface.module.css';

/** Kept for compatibility. Both densities now show the actual circular stamps. */
export type CardDensity = 'compact' | 'full';
export interface CafeCardPreviewProps {
  name: string; bg: string; fg: string; logoUrl: string | null;
  filled?: number; total?: number; goal?: string; tag?: string; footer?: string;
  density?: CardDensity; customerName?: string; lastStampAt?: string | null;
  locale?: string; stampStyle?: string;
}
function Stamp({ variant }: { variant: string }) {
  if (variant === 'dot') return <svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="5" fill="currentColor" /></svg>;
  if (variant === 'bean') return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><ellipse cx="14" cy="14" rx="6.5" ry="9" transform="rotate(32 14 14)" stroke="currentColor" strokeWidth="1.5" /><path d="M18 6.5c-8 3-2 11-8 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M6.5 6.5h12.8v10.2a5 5 0 0 1-5 5h-2.8a5 5 0 0 1-5-5V6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M19.5 8h1.7a3.3 3.3 0 0 1 0 6.6h-1.7M6 24h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

/** One vector/text surface for wallet, opened card and owner preview; never a screenshot. */
export function CafeCardPreview({
  name, bg, fg, logoUrl, filled = 5, total = 8, goal = 'Free coffee', tag = 'Loyalty', footer,
  density = 'full', customerName = '', lastStampAt, locale = 'en', stampStyle = 'cup',
}: CafeCardPreviewProps) {
  const layout = stampLayout(total, filled);
  const copy = cardCopy(locale);
  const date = cardStampDate(lastStampAt, locale);
  const progress = cardFooter(footer, goal, Math.max(0, total - filled));
  const safeBg = /^#[a-f0-9]{6}$/i.test(bg) ? bg : '#151311';
  const safeFg = /^#[a-f0-9]{6}$/i.test(fg) ? fg : '#e8dcc6';
  const style = { '--loyalty-bg': safeBg, '--loyalty-fg': safeFg, '--loyalty-columns': layout.columns } as CSSProperties;
  const initials = name.trim().charAt(0).toUpperCase() || 'B';
  return (
    <div className={styles.card} style={style} data-card-surface="loyalty" data-density={density}>
      <div className={styles.header}>
        <div className={styles.logo} aria-hidden="true">
          <span>{initials}</span>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={logoUrl} src={logoUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
              onError={event => { event.currentTarget.style.display = 'none'; }} />
          )}
        </div>
        <div className={styles.identity}>
          <div className={styles.name} title={name}><bdi>{name}</bdi></div>
          <div className={styles.tag}>{tag}</div>
        </div>
        <div className={styles.balance}>
          <div className={styles.stampLabel}>{copy.stamps}</div>
          <div className={styles.numbers} dir="ltr">{filled}<span>/</span>{total}</div>
        </div>
      </div>
      <div className={styles.stamps} role="img" aria-label={`${copy.stamps}: ${filled} / ${total}`}>
        {Array.from({ length: layout.count }, (_, i) => (
          <span key={i} className={styles.stamp} data-filled={i < layout.stamped ? 'true' : 'false'} aria-hidden="true">
            <Stamp variant={stampStyle} />
          </span>
        ))}
      </div>
      <div className={styles.reward}>
        <span className={styles.goal}>{goal}</span>
        <span className={styles.progress}>{progress}</span>
      </div>
      {(customerName || lastStampAt !== undefined) && (
        <div className={styles.personal}>
          {customerName ? <span className={styles.customer}><bdi>{customerName}</bdi></span> : <span />}
          <span className={styles.activity}>
            {date ? <><span>{copy.lastStamp}</span><time dateTime={lastStampAt || undefined}>{date}</time></> : <span>{copy.noStamps}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SectionHeader } from '@/components/ui';

const BASE = (process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'https://brewistan.com').replace(/\/$/, '');

interface Branch { id: string; name: string; slug: string }

/**
 * One permanent QR per branch. Customers scan it to open (or get) this café's card.
 * Scanning it never gives a stamp: stamps are only added when staff scan the customer's code.
 */
export function BranchQrCodes({ cafeName, cafeSlug, branches }: { cafeName: string; cafeSlug: string; branches: Branch[] }) {
  return (
    <section className="mt-10">
      <SectionHeader title="Branch QR codes"
        description="Print and place these at each counter. Customers scan to open their card; stamps are still added only by your staff." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {branches.map((b) => <BranchQr key={b.id} cafeName={cafeName} url={`${BASE}/c/${cafeSlug}/${b.slug}`} branch={b} />)}
      </div>
    </section>
  );
}

function BranchQr({ cafeName, url, branch }: { cafeName: string; url: string; branch: Branch }) {
  const [svg, setSvg] = useState('');
  const [png, setPng] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const opts = { errorCorrectionLevel: 'H' as const, margin: 2, color: { dark: '#151311', light: '#ffffff' } };
    QRCode.toString(url, { ...opts, type: 'svg' }).then(setSvg);
    QRCode.toDataURL(url, { ...opts, width: 1200 }).then(setPng);
  }, [url]);
  const file = `${cafeName}-${branch.name}-qr.png`.replace(/[^\w.-]+/g, '-');
  return (
    <div className="card flex flex-col items-center p-5 text-center">
      <div className="text-[15px] font-semibold">{branch.name}</div>
      <div className="mt-3 aspect-square w-full max-w-[200px] rounded-lg border border-line p-2 [&>svg]:h-full [&>svg]:w-full"
        role="img" aria-label={`QR code for ${branch.name}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <code dir="ltr" className="mt-3 block max-w-full truncate text-[12px] text-ink-muted">{url.replace(/^https:\/\//, '')}</code>
      <div className="mt-4 flex w-full gap-2">
        <a className={`btn-primary btn-sm flex-1 ${png ? '' : 'pointer-events-none opacity-50'}`} href={png || undefined} download={file}>Download</a>
        <button className="btn-ghost btn-sm flex-1" onClick={async () => {
          try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
        }}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
    </div>
  );
}

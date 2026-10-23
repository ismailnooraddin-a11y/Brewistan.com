import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, Notice } from '@/components/ui';
import { StatusBanner } from '@/components/StatusBanner';
import { VerificationUpload } from './VerificationUpload';

export default async function VerificationPage() {
  const { cafe } = await requireOwnerContext();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t('verification.title')} description="Brewistan is reserved for premium cafes. We check every cafe before it goes live." />
      <div className="space-y-6">
        <StatusBanner cafe={cafe} />
        {cafe.status === 'active' ? (
          <Notice tone="good" title="Verified">Your cafe is approved and live.</Notice>
        ) : (
          <div className="card space-y-5">
            <ol className="list-decimal space-y-2 ps-5 text-sm">
              <li>Write this code on paper, or show it on a second screen: <span className="ms-1 rounded bg-gold-soft px-2 py-1 font-mono text-lg tracking-widest text-gold-deep" dir="ltr">{cafe.verification_code}</span></li>
              <li>Take a live photo at your cafe that shows the cafe sign and the code together.</li>
              <li>Upload it here. Make sure your Instagram link is correct: <span dir="ltr" className="text-ink-muted">{cafe.instagram_url ?? 'not set'}</span></li>
            </ol>
            <VerificationUpload key={cafe.id} cafeId={cafe.id} hasPhoto={!!cafe.verification_photo_path} />
          </div>
        )}
      </div>
    </>
  );
}

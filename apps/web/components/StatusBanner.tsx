import Link from 'next/link';
import { Notice } from './ui';
import type { OwnerCafe } from '@/lib/server-context';

export function StatusBanner({ cafe }: { cafe: OwnerCafe }) {
  if (cafe.status === 'active') return null;
  if (cafe.status === 'pending') {
    return (
      <Notice tone="warn" title="Your cafe is waiting for approval">
        {cafe.verification_photo_path
          ? 'We have your verification photo. Review takes up to two working days, and we will message you on WhatsApp.'
          : <>Upload your verification photo to start the review. <Link className="underline" href="/dashboard/verification">Go to verification</Link></>}
      </Notice>
    );
  }
  if (cafe.status === 'rejected') {
    return (
      <Notice tone="bad" title="Your cafe was not approved">
        {cafe.rejection_reason ?? 'Contact support for details.'} You can update your details and re-apply after seven days.
      </Notice>
    );
  }
  return (
    <Notice tone="bad" title={cafe.status === 'suspended' ? 'Your cafe is suspended' : 'Your cafe is closed'}>
      Scanning is paused. Contact support on WhatsApp to resolve this.
    </Notice>
  );
}

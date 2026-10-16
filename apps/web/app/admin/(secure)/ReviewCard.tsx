'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callFunction, createClient } from '@/lib/supabase/client';
import { formatDate } from '@/components/ui';

interface Cafe {
  id: string;
  name: string;
  instagram_url: string | null;
  business_registration_no: string | null;
  verification_code: string;
  verification_photo_path: string | null;
  status: string;
  created_at: string;
}

export function ReviewCard({ cafe }: { cafe: Cafe }) {
  const router = useRouter();
  const supabase = createClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function viewPhoto() {
    if (!cafe.verification_photo_path) return;
    const reason = prompt('Reason for viewing this verification photo (logged):', 'Cafe approval review');
    if (!reason?.trim()) return;
    const { error: logError } = await supabase.rpc('admin_log_view', { p_cafe: cafe.id, p_reason: reason.trim() });
    if (logError) return setError(logError.message);
    const { data, error } = await supabase.storage.from('verification').createSignedUrl(cafe.verification_photo_path, 300);
    if (error) setError(error.message);
    else setPhoto(data.signedUrl);
  }

  async function decide(decision: 'approve' | 'reject') {
    let reason: string | undefined;
    if (decision === 'reject') {
      reason = prompt('Reason shown to the owner:') ?? undefined;
      if (!reason?.trim()) return;
    }
    setBusy(true);
    setError(null);
    try {
      await callFunction('admin-review', { cafeId: cafe.id, decision, reason });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-2 text-sm">
        <div className="font-display text-xl">{cafe.name}</div>
        <div>Registered {formatDate(cafe.created_at, true)}</div>
        <div>Instagram: {cafe.instagram_url ? <a className="text-gold-deep underline" href={cafe.instagram_url} target="_blank" rel="noreferrer noopener">{cafe.instagram_url}</a> : '—'}</div>
        <div>Business registration: <span className="font-mono">{cafe.business_registration_no ?? '—'}</span></div>
        <div>Code that must appear in the photo: <span className="font-mono text-lg tracking-widest">{cafe.verification_code}</span></div>
        {error && <p className="text-bad">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button className="btn-gold" disabled={busy || !cafe.verification_photo_path} onClick={() => decide('approve')}>Approve</button>
          <button className="btn-danger" disabled={busy} onClick={() => decide('reject')}>Reject</button>
        </div>
      </div>
      <div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Verification" className="w-full rounded-xl object-cover" />
        ) : cafe.verification_photo_path ? (
          <button className="btn-ghost w-full" onClick={viewPhoto}>View verification photo</button>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-ink-muted">No photo uploaded yet</div>
        )}
      </div>
    </div>
  );
}

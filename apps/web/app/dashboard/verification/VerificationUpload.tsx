'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function VerificationUpload({ cafeId, hasPhoto }: { cafeId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(hasPhoto ? 'Photo received. You can replace it if needed.' : null);

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) return setMsg('Please choose a photo.');
    if (file.size > 10_000_000) return setMsg('The photo must be under 10 MB.');
    setBusy(true);
    const supabase = createClient();
    const path = `${cafeId}/verification-${Date.now()}.${file.type.split('/')[1] ?? 'jpg'}`;
    const { error } = await supabase.storage.from('verification').upload(path, file, { contentType: file.type });
    if (!error) {
      const { error: e2 } = await supabase.from('cafes').update({ verification_photo_path: path }).eq('id', cafeId);
      setMsg(e2 ? e2.message : 'Photo received. We will review it within two working days.');
    } else {
      setMsg(error.message);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="btn-gold cursor-pointer">
        {busy ? 'Uploading…' : 'Take or upload photo'}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {msg && <p className="text-sm text-ink-muted">{msg}</p>}
    </div>
  );
}

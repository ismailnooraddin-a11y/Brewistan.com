'use client';

import { useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (matches storage bucket limit)

export function LogoUploader({
  cafeId,
  currentLogoUrl,
}: {
  cafeId: string;
  currentLogoUrl: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('Use PNG, JPEG, WebP, or SVG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Maximum size is 2 MB.');
      return;
    }
    setBusy(true);

    // Path scheme: {cafe_id}/logo.<ext> — storage RLS keys on first segment.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${cafeId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('cafe-logos')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage.from('cafe-logos').getPublicUrl(path);

    const { error: updateError } = await supabase
      .from('cafes')
      .update({ logo_url: pub.publicUrl })
      .eq('id', cafeId);

    if (updateError) {
      setError(`Saved file but couldn't update record: ${updateError.message}`);
      setBusy(false);
      return;
    }

    setPreview(pub.publicUrl);
    setBusy(false);
    router.refresh();
  }

  async function removeLogo() {
    if (!preview) return;
    if (!confirm('Remove the café logo?')) return;
    setBusy(true);
    setError(null);

    // Best-effort: extract storage path from public URL and delete.
    const marker = '/cafe-logos/';
    const idx = preview.indexOf(marker);
    if (idx > -1) {
      const storagePath = preview.slice(idx + marker.length);
      await supabase.storage.from('cafe-logos').remove([storagePath]);
    }

    const { error: updateError } = await supabase
      .from('cafes')
      .update({ logo_url: null })
      .eq('id', cafeId);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    setPreview(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 14,
          border: `1.5px dashed var(--line-strong)`,
          borderRadius: 14,
          background: 'rgba(20,37,29,0.02)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: preview ? `center / cover no-repeat url(${preview})` : 'var(--cream)',
            border: '1px solid var(--line)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--muted)',
            flexShrink: 0,
          }}
          aria-label="Logo preview"
        >
          {!preview && <ImageIcon size={20} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Café logo</div>
          <div className="hint" style={{ fontSize: 12 }}>PNG, JPEG, WebP, or SVG · max 2 MB · square works best</div>
          {error && <div className="error" style={{ marginTop: 6, color: '#a33a3a', fontSize: 12 }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (e.target) e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={14} /> {busy ? 'Uploading…' : preview ? 'Replace' : 'Upload'}
          </button>
          {preview && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={removeLogo} aria-label="Remove logo">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

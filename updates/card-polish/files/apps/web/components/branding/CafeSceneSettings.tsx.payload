'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cardSceneUrl, selectedScene, TEA_ROOM_SCENE, type SceneChoice } from '@/lib/customer/card-presentation';

const MAX_SOURCE_BYTES = 8_000_000;
const MAX_UPLOAD_BYTES = 950_000; // Existing branding bucket limit is 1 MB.

/** Decode/re-encode to strip metadata, bound dimensions and keep the original bucket limits. */
async function prepareScene(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a JPEG, PNG or WebP image under 8 MB.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 45_000_000) {
      throw new Error('Choose an image smaller than 45 megapixels.');
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1440 / image.naturalWidth, 2560 / image.naturalHeight);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.74, 0.62, 0.50]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size < MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error('This image is too detailed. Try a smaller portrait image.');
  } finally { URL.revokeObjectURL(objectUrl); }
}

/** Uses the existing owner-scoped branding Storage bucket and cafes.brand JSON.
 * No subscription, database, authentication or QR rules are changed here.
 */
export function CafeSceneSettings({ cafeId, tier, brand }: {
  cafeId: string; tier: string; brand: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [choice, setChoice] = useState<SceneChoice>(selectedScene(brand));
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setChoice(selectedScene(brand)); setFile(null); setMessage(null);
  }, [cafeId, brand.scene, brand.scene_path]);
  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file); setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (tier !== 'bespoke') return (
    <section className="card mt-6">
      <h2 className="text-base font-semibold">Cafe atmosphere</h2>
      <p className="mt-2 text-sm text-ink-muted">Custom backgrounds are a Bespoke feature. Classic and Signature cards keep their elegant black page. Your loyalty card design is unchanged.</p>
    </section>
  );

  const preview = choice === 'tea_room' ? TEA_ROOM_SCENE : choice === 'custom'
    ? filePreview || cardSceneUrl(cafeId, tier, { ...brand, scene: 'custom' }, process.env.NEXT_PUBLIC_SUPABASE_URL)
    : null;

  async function publish() {
    if (busy) return;
    setBusy(true); setMessage(null);
    let uploadedPath: string | null = null;
    let committed = false;
    try {
      // Check the authoritative tier; a stale browser must not publish after a downgrade.
      const before = await supabase.from('cafes').select('tier,brand').eq('id', cafeId).single();
      if (before.error || !before.data) throw new Error('Could not check your cafe. Please retry.');
      if (before.data.tier !== 'bespoke') throw new Error('This feature requires the Bespoke plan.');
      if (choice === 'custom' && file) {
        const blob = await prepareScene(file);
        const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
        uploadedPath = `${cafeId}/scene-${crypto.randomUUID()}.${extension}`;
        const result = await supabase.storage.from('branding').upload(uploadedPath, blob, { contentType: blob.type, upsert: false });
        if (result.error) { uploadedPath = null; throw new Error('The background upload failed. Please retry.'); }
      }
      // Fetch again after upload so we retain the most recent card colours/template.
      const current = await supabase.from('cafes').select('tier,brand').eq('id', cafeId).single();
      if (current.error || !current.data || current.data.tier !== 'bespoke') throw new Error('Your cafe settings changed. Reload and try again.');
      const next: Record<string, string> = { ...(current.data.brand ?? {}), scene: choice };
      if (choice === 'custom') {
        next.scene_path = uploadedPath || next.scene_path || '';
        if (!cardSceneUrl(cafeId, 'bespoke', next, process.env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error('Choose a background image first.');
      } else { delete next.scene_path; }
      const saved = await supabase.from('cafes').update({ brand: next }).eq('id', cafeId).eq('tier', 'bespoke').select('id').single();
      if (saved.error || !saved.data) throw new Error('The background could not be published. Please retry.');
      committed = true;
      setMessage('Published. Customers will see this background when they open this cafe card.');
      setFile(null);
      router.refresh();
    } catch (error) {
      if (uploadedPath && !committed) await supabase.storage.from('branding').remove([uploadedPath]);
      setMessage(error instanceof Error ? error.message : 'The background could not be saved.');
    } finally { setBusy(false); }
  }

  return (
    <section className="card mt-6 space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Bespoke</div>
        <h2 className="mt-1 text-lg font-semibold">Cafe atmosphere</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Choose the background behind your opened customer card. The multi-card wallet stays black and uncluttered. No background is selected by default.</p>
      </div>
      <fieldset disabled={busy}>
        <legend className="label">Card-page background</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ['none', 'Classic black', 'Quiet and timeless.'],
            ['tea_room', 'Nana\u2019s Tea room', 'Your selected warm tea-house scene.'],
            ['custom', 'Your own image', 'Use a photo that represents your cafe.'],
          ] as const).map(([value, label, caption]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 ${choice === value ? 'border-gold bg-cream-deep' : 'border-line'}`}>
              <span className="flex items-center gap-2 text-sm font-medium"><input type="radio" name={`scene-${cafeId}`} value={value} checked={choice === value} onChange={() => { setChoice(value); setMessage(null); }} />{label}</span>
              <span className="mt-1 block text-xs text-ink-muted">{caption}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {choice === 'custom' && <div>
        <label className="label" htmlFor={`cafe-scene-file-${cafeId}`}>Background image</label>
        <input id={`cafe-scene-file-${cafeId}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
          onChange={event => { setFile(event.target.files?.[0] ?? null); setMessage(null); }} className="max-w-full text-sm" />
        <p className="mt-2 text-xs text-ink-muted">Portrait images work best. JPEG, PNG or WebP under 8 MB; automatically optimized to fit the existing 1 MB upload limit. Only upload images you are entitled to use.</p>
      </div>}
      <div className="relative h-48 max-w-sm overflow-hidden rounded-xl bg-[#121110]">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected cafe atmosphere" className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">{choice === 'none' ? 'Black background' : 'Background preview'}</span>
      </div>
      <p className="text-xs text-ink-muted">The card and QR remain readable on their own surfaces. Backgrounds are displayed only while the cafe is on the Bespoke plan.</p>
      {message && <p role="status" className="text-sm text-ink-muted">{message}</p>}
      <button className="btn-primary" type="button" onClick={() => void publish()} disabled={busy}>{busy ? 'Publishing...' : 'Publish background'}</button>
    </section>
  );
}

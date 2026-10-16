'use client';
import { contrastRatio } from '@/lib/validation';
import { CARD_DESIGNS, cardDesignById } from '@/lib/card-designs';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';


export function BrandingForm({ cafeId, tier, brand, logoUrl }: {
  cafeId: string; tier: 'signature' | 'bespoke'; brand: Record<string, string>; logoUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [template, setTemplate] = useState(cardDesignById(brand.template).id);
  const [primary, setPrimary] = useState(brand.primary ?? '#151311');
  const [accent, setAccent] = useState(brand.accent ?? '#b08d57');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadLogo(file: File) {
    if (file.size > 1_000_000) {
      setMsg('Logo must be under 1 MB.');
      return;
    }
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
      setMsg('Use a PNG, WebP or JPEG logo, ideally on a transparent background.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
    const path = `${cafeId}/logo-${Date.now()}.${({ 'image/png':'png','image/webp':'webp','image/jpeg':'jpg' } as Record<string,string>)[file.type]}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: false, contentType: file.type });
    let saveError: { message: string } | null = error;
    if (!error) {
      const result = await supabase.from('cafes').update({ logo_path: path }).eq('id', cafeId).select('id').single();
      saveError = result.error;
      if (saveError) await supabase.storage.from('branding').remove([path]);
    }
    setBusy(false);
    setMsg(saveError ? 'The logo could not be saved. Please retry.' : 'Logo updated.');
    router.refresh();
    } catch { setMsg('The logo could not be saved. Please retry.'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (busy) return;
    if (tier === 'bespoke' && !(contrastRatio(primary, accent) >= 4.5)) { setMsg('Choose colors with a contrast ratio of at least 4.5:1 so the card stays readable.'); return; }
    setBusy(true);
    try {
    const value = tier === 'bespoke' ? { template, primary, accent } : { template };
    const { error } = await supabase.from('cafes').update({ brand: value }).eq('id', cafeId).select('id').single();
    setBusy(false);
    setMsg(error ? error.message : 'Saved.');
    router.refresh();
    } catch { setMsg('Branding could not be saved. Please retry.'); }
    finally { setBusy(false); }
  }

  const t = cardDesignById(template);
  const bg = tier === 'bespoke' ? primary : t.bg;
  const fg = tier === 'bespoke' ? accent : t.fg;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card space-y-6">
        <div>
          <label className="label" htmlFor="logo">Logo</label>
          <input id="logo" className="max-w-full" type="file" accept="image/png,image/webp,image/jpeg" disabled={busy}
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </div>
        <div>
          <div className="label">Template</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CARD_DESIGNS.map((x) => (
              <button key={x.id} type="button" aria-pressed={template === x.id} disabled={busy} onClick={() => setTemplate(x.id)}
                className={`rounded-xl border-2 p-3 text-sm ${template === x.id ? 'border-gold' : 'border-transparent'}`}
                style={{ background: x.bg, color: x.fg }}>
                {x.name}
              </button>
            ))}
          </div>
        </div>
        {tier === 'bespoke' && (
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">Card colour <input type="color" className="ml-2 align-middle" value={primary} onChange={(e) => setPrimary(e.target.value)} /></label>
            <label className="text-sm">Accent colour <input type="color" className="ml-2 align-middle" value={accent} onChange={(e) => setAccent(e.target.value)} /></label>
          </div>
        )}
        {msg && <p role="status" className="text-sm text-ink-muted">{msg}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>Save branding</button>
      </div>
      <div>
        <div className="label">Preview</div>
        <p className="mb-3 text-xs text-ink-muted">Contrast: {contrastRatio(bg, fg).toFixed(2)}:1</p>
        <div className="min-w-0 rounded-2xl p-5 shadow-lg" style={{ background: bg, color: fg }}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 rounded-full object-contain" />}
            <span className="font-display text-lg">Your cafe</span>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-md" style={{ background: fg, opacity: i < 5 ? 0.9 : 0.15 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

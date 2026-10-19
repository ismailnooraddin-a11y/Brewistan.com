'use client';
import { contrastRatio } from '@/lib/validation';
import { CARD_DESIGNS, cardDesignById, STAMP_STYLES, stampStyleById } from '@/lib/card-designs';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Small flat previews for the stamp-style picker. These only need to be
// recognisable, not a pixel match for the mobile app's drawn version.
function StampPreview({ styleId, color }: { styleId: string; color: string }) {
  if (styleId === 'dot') {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10">
        <circle cx="20" cy="20" r="14" fill={color} />
      </svg>
    );
  }
  if (styleId === 'bean') {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10">
        <path d="M20 6 C30 10 30 30 20 34 C10 30 10 10 20 6 Z" fill={color} />
        <path d="M19 10 C24 20 19 20 19 30" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  // cup
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10">
      <path d="M9 9 h22 v23 a4 4 0 0 1 -4 4 h-14 a4 4 0 0 1 -4 -4 Z" fill={color} />
      <ellipse cx="20" cy="9" rx="11" ry="2.4" fill={color} />
      <path d="M31 13 a6 7 0 0 1 0 12" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function BrandingForm({ cafeId, cafeName, tier, brand, logoUrl }: {
  cafeId: string; cafeName: string; tier: 'signature' | 'bespoke'; brand: Record<string, string>; logoUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(cafeName);
  const [template, setTemplate] = useState(cardDesignById(brand.template).id);
  const [primary, setPrimary] = useState(brand.primary ?? cardDesignById(brand.template).bg);
  const [accent, setAccent] = useState(brand.accent ?? cardDesignById(brand.template).fg);
  const [stamp, setStamp] = useState(stampStyleById(brand.stamp).id);
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

  function applyPreset(designId: string) {
    const d = cardDesignById(designId);
    setTemplate(d.id);
    setPrimary(d.bg);
    setAccent(d.fg);
  }

  async function save() {
    if (busy) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 2) { setMsg('Enter a name with at least 2 characters.'); return; }
    if (!(contrastRatio(primary, accent) >= 4.5)) { setMsg('Choose colors with a contrast ratio of at least 4.5:1 so the card stays readable.'); return; }
    setBusy(true);
    try {
    const value = { template, primary, accent, stamp };
    const { error } = await supabase.from('cafes').update({ name: trimmedName, brand: value }).eq('id', cafeId).select('id').single();
    setBusy(false);
    setMsg(error ? error.message : 'Saved.');
    router.refresh();
    } catch { setMsg('Branding could not be saved. Please retry.'); }
    finally { setBusy(false); }
  }

  const bg = primary, fg = accent;
  const displayName = name.trim() || 'Your cafe';

  return (
    <div className="space-y-6">
      {tier === 'signature' && (
        <p className="rounded-lg border border-ink/10 bg-ink/[0.03] px-4 py-3 text-sm text-ink-muted">
          You can set your own card colours below. Want our team to design it for you instead? Upgrade to Bespoke.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card space-y-6">
          <div>
            <label className="label" htmlFor="card-name">Card name</label>
            <input
              id="card-name"
              className="input w-full max-w-sm"
              value={name}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-muted">This is how your cafe's name reads on the customer's card.</p>
          </div>
          <div>
            <label className="label" htmlFor="logo">Logo</label>
            <input id="logo" className="max-w-full" type="file" accept="image/png,image/webp,image/jpeg" disabled={busy}
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <p className="mt-1 text-xs text-ink-muted">PNG, WebP or JPEG, under 1 MB. A square logo on a transparent background works best.</p>
          </div>

          <div>
            <div className="label">Quick-start presets</div>
            <p className="mb-2 text-xs text-ink-muted">Pick one to fill in a starting colour pair, then fine-tune it below.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CARD_DESIGNS.map((x) => (
                <button key={x.id} type="button" aria-pressed={template === x.id} disabled={busy} onClick={() => applyPreset(x.id)}
                  className={`rounded-xl border-2 p-3 text-sm ${template === x.id && primary === x.bg && accent === x.fg ? 'border-gold' : 'border-transparent'}`}
                  style={{ background: x.bg, color: x.fg }}>
                  {x.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">Card colour <input type="color" className="ml-2 align-middle" value={primary} onChange={(e) => setPrimary(e.target.value)} /></label>
            <label className="text-sm">Accent colour <input type="color" className="ml-2 align-middle" value={accent} onChange={(e) => setAccent(e.target.value)} /></label>
          </div>

          <div>
            <div className="label">Stamp style</div>
            <p className="mb-2 text-xs text-ink-muted">How a single collected stamp looks on the card.</p>
            <div className="grid grid-cols-3 gap-3">
              {STAMP_STYLES.map((s) => (
                <button key={s.id} type="button" aria-pressed={stamp === s.id} disabled={busy} onClick={() => setStamp(s.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 ${stamp === s.id ? 'border-gold bg-gold/5' : 'border-ink/10'}`}>
                  <StampPreview styleId={s.id} color={fg} />
                  <span className="text-xs">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {msg && <p role="status" className="text-sm text-ink-muted">{msg}</p>}
          <button className="btn-primary" onClick={save} disabled={busy}>Save branding</button>
        </div>

        <div>
          <div className="label">Preview</div>
          <p className="mb-3 text-xs text-ink-muted">Contrast: {contrastRatio(bg, fg).toFixed(2)}:1</p>
          <div
            className="relative min-w-0 overflow-hidden rounded-2xl p-5"
            style={{
              background: `linear-gradient(135deg, ${bg} 0%, ${fg} 2%, ${bg} 45%, color-mix(in srgb, ${bg} 60%, black) 100%)`,
              boxShadow: `0 18px 40px -8px color-mix(in srgb, ${bg} 70%, black 60%), 0 2px 8px rgba(0,0,0,0.25)`,
              border: '1px solid rgba(255,255,255,0.10)',
              color: fg,
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%)' }}
            />
            <div className="relative flex items-center gap-3">
              {logoUrl ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/90 p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                </span>
              ) : null}
              <span className="font-display text-lg">{displayName}</span>
            </div>
            <div className="relative mt-6 grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-md" style={{ opacity: i < 5 ? 1 : 0.25 }}>
                  <StampPreview styleId={stamp} color={fg} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

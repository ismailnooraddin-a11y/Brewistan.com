'use client';
import { contrastRatio } from '@/lib/validation';
import { CARD_DESIGNS, cardDesignById } from '@/lib/card-designs';
import { CafeCardPreview } from '@/components/CafeCardPreview';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function BrandingForm({ cafeId, cafeName, tier, brand, logoUrl }: {
  cafeId: string; cafeName: string; tier: 'signature' | 'bespoke'; brand: Record<string, string>; logoUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(cafeName);
  const [template, setTemplate] = useState(cardDesignById(brand.template).id);
  const [primary, setPrimary] = useState(brand.primary ?? cardDesignById(brand.template).bg);
  const [accent, setAccent] = useState(brand.accent ?? cardDesignById(brand.template).fg);
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
      const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' } as Record<string, string>)[file.type];
      const path = `${cafeId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: false, contentType: file.type });
      let saveError: { message: string } | null = error;
      if (!error) {
        const result = await supabase.from('cafes').update({ logo_path: path }).eq('id', cafeId).select('id').single();
        saveError = result.error;
        if (saveError) await supabase.storage.from('branding').remove([path]);
      }
      setMsg(saveError ? 'The logo could not be saved. Please retry.' : 'Logo updated.');
      router.refresh();
    } catch {
      setMsg('The logo could not be saved. Please retry.');
    } finally {
      setBusy(false);
    }
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
    if (!(contrastRatio(primary, accent) >= 4.5)) { setMsg('Choose colours with a contrast ratio of at least 4.5:1 so the card stays readable.'); return; }
    if (!window.confirm('Publish this design? Customers will see it the next time they open the app.')) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('cafes')
        .update({ name: trimmedName, brand: { template, primary, accent } })
        .eq('id', cafeId).select('id').single();
      setMsg(error ? 'Branding could not be saved. Please retry.' : 'Published. This is now your live card.');
      router.refresh();
    } catch {
      setMsg('Branding could not be saved. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  const ratio = contrastRatio(primary, accent);

  return (
    <div className="space-y-6">
      {tier === 'signature' && (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-[13.5px] text-ink-muted">
          Design your card below. Want our team to design it for you instead? Upgrade to Bespoke.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="card space-y-6">
          <div>
            <label className="label" htmlFor="card-name">Card name</label>
            <input id="card-name" className="input w-full max-w-sm" value={name} maxLength={40} disabled={busy}
              onChange={(e) => setName(e.target.value)} />
            <p className="mt-1 text-xs text-ink-muted">How your cafe’s name reads on the customer’s card.</p>
          </div>

          <div>
            <label className="label" htmlFor="logo">Logo</label>
            <input id="logo" className="max-w-full text-sm" type="file" accept="image/png,image/webp,image/jpeg" disabled={busy}
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <p className="mt-1 text-xs text-ink-muted">PNG, WebP or JPEG under 1 MB. A square logo on a transparent background looks best.</p>
          </div>

          <div>
            <div className="label">Start from a preset</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CARD_DESIGNS.map((x) => {
                const active = template === x.id && primary === x.bg && accent === x.fg;
                return (
                  <button key={x.id} type="button" aria-pressed={active} disabled={busy} onClick={() => applyPreset(x.id)}
                    className={`h-10 rounded-md text-[13px] font-medium ring-offset-2 transition-shadow duration-150 ${active ? 'ring-2 ring-gold' : 'ring-1 ring-black/[0.06]'}`}
                    style={{ background: x.bg, color: x.fg }}>
                    {x.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label">Or choose your own colours</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex h-11 items-center justify-between rounded-md border border-line bg-white px-3 text-[13.5px] text-ink-soft">
                Card colour
                <input type="color" className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              </label>
              <label className="flex h-11 items-center justify-between rounded-md border border-line bg-white px-3 text-[13.5px] text-ink-soft">
                Text and stamp colour
                <input type="color" className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" value={accent} onChange={(e) => setAccent(e.target.value)} />
              </label>
            </div>
            <p className={`mt-2 text-xs ${ratio >= 4.5 ? 'text-ink-muted' : 'text-bad'}`}>
              Readability {ratio.toFixed(1)}:1 {ratio >= 4.5 ? '· good' : '· too low, pick colours further apart'}
            </p>
          </div>

          {msg && <p role="status" className="text-sm text-ink-muted">{msg}</p>}
          <button className="btn-primary" onClick={save} disabled={busy}>Publish card</button>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className="label">Live preview · customer app</div>
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-line bg-cream-deep px-6 py-10">
            <CafeCardPreview name={name.trim() || 'Your cafe'} bg={primary} fg={accent} logoUrl={logoUrl} />
          </div>
          <p className="mt-2 text-center text-xs text-ink-muted">Shown with 5 of 8 stamps collected.</p>
        </div>
      </div>
    </div>
  );
}

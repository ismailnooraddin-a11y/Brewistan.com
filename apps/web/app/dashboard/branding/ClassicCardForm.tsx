'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Classic cafes don't get a logo or colour choices, those are paid features
// of Signature and Bespoke. The one thing they can set is how their name
// reads on the card. Their customers' card colour is set automatically by
// each customer's own status tier (bronze -> silver -> gold -> matte black),
// not by the cafe, so the preview here stays plain and dark, matching the
// starting tier, with a caption explaining why there's no colour to pick.
export function ClassicCardForm({ cafeId, cafeName }: { cafeId: string; cafeName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(cafeName);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setMsg('Enter a name with at least 2 characters.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('cafes').update({ name: trimmed }).eq('id', cafeId).select('id').single();
      setMsg(error ? 'The name could not be saved. Please retry.' : 'Saved.');
      if (!error) router.refresh();
    } catch {
      setMsg('The name could not be saved. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card space-y-5">
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
        {msg && <p role="status" className="text-sm text-ink-muted">{msg}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>Save</button>
        <p className="border-t border-ink/10 pt-4 text-sm text-ink-muted">
          The card's colour changes on its own as each customer collects more stamps, from bronze to silver, gold and
          matte black. Upgrade to Signature to add your logo and choose a premium template, or Bespoke for a fully
          custom card designed by our team.
        </p>
      </div>

      <div>
        <div className="label">Preview</div>
        <div className="rounded-xl border border-ink/10 bg-[#6E4423] p-5 text-[#F3E9DD]">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg">{name.trim() || 'Your cafe'}</span>
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] tracking-wide">BRONZE</span>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-md bg-current" style={{ opacity: i < 3 ? 0.95 : 0.2 }} />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-muted">Shown here at a new customer's starting tier.</p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CafeCardPreview } from '@/components/CafeCardPreview';

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
        <p className="border-t border-line pt-4 text-[13.5px] text-ink-muted">
          The card's colour changes on its own as each customer collects more stamps, from bronze to silver, gold and
          matte black. Upgrade to Signature to add your logo and choose a premium template, or Bespoke for a fully
          custom card designed by our team.
        </p>
      </div>

      <div>
        <div className="label">Live preview · customer app</div>
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-line bg-cream-deep px-6 py-10">
          <CafeCardPreview name={name.trim() || 'Your cafe'} bg="#6E4423" fg="#F3E9DD" logoUrl={null} filled={3} tag="Bronze" />
        </div>
        <p className="mt-2 text-xs text-ink-muted">Shown here at a new customer's starting tier.</p>
      </div>
    </div>
  );
}

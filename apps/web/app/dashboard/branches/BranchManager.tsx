'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui';

interface Branch { id: string; name: string; address: string | null; active: boolean }

export function BranchManager({ cafeId, branches }: { cafeId: string; branches: Branch[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from('branches').insert({
      cafe_id: cafeId,
      name: String(f.get('name')).trim(),
      address: String(f.get('address') ?? '').trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      form.reset();
      router.refresh();
    }
  }

  async function toggle(b: Branch) {
    const { error } = await supabase.from('branches').update({ active: !b.active }).eq('id', b.id);
    if (error) setError(error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Branch</th><th>Address</th><th>Status</th><th /></tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.name}</td>
                <td className="text-ink-muted">{b.address ?? '—'}</td>
                <td><Badge tone={b.active ? 'good' : 'neutral'}>{b.active ? 'Open' : 'Closed'}</Badge></td>
                <td className="text-right rtl:text-left">
                  <button className="btn-ghost px-3 py-1.5" onClick={() => toggle(b)}>{b.active ? 'Close branch' : 'Reopen'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={add} className="card grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="bname">New branch name</label>
          <input id="bname" name="name" className="input" required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="baddr">Address</label>
          <input id="baddr" name="address" className="input" maxLength={200} />
        </div>
        <button className="btn-primary" disabled={busy}>Add branch</button>
        {error && <p className="text-sm text-bad sm:col-span-3">{error}</p>}
      </form>
    </div>
  );
}

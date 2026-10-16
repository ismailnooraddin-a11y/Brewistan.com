'use client';

import { useRouter } from 'next/navigation';
import { callFunction, createClient } from '@/lib/supabase/client';

export function CafeAdminActions({ cafeId, status, tier }: { cafeId: string; status: string; tier: string }) {
  const router = useRouter();

  async function setTier(value: string) {
    const { error } = await createClient().rpc('admin_set_tier', { p_cafe: cafeId, p_tier: value });
    if (error) alert(error.message);
    router.refresh();
  }

  async function suspend(decision: 'suspend' | 'reactivate') {
    const reason = decision === 'suspend' ? prompt('Reason for suspension:') : 'Reactivated';
    if (!reason?.trim()) return;
    try {
      await callFunction('admin-review', { cafeId, decision, reason });
    } catch (e) {
      alert((e as Error).message);
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <select className="rounded border border-ink/15 px-2 py-1 text-xs" value={tier} onChange={(e) => setTier(e.target.value)}>
        <option value="classic">Classic</option>
        <option value="signature">Signature</option>
        <option value="bespoke">Bespoke</option>
      </select>
      {status === 'active' && <button className="btn-danger px-2 py-1 text-xs" onClick={() => suspend('suspend')}>Suspend</button>}
      {status === 'suspended' && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => suspend('reactivate')}>Reactivate</button>}
    </div>
  );
}

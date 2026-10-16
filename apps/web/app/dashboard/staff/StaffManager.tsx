'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callFunction } from '@/lib/supabase/client';
import { asciiDigits } from '@/lib/validation';
import { Badge } from '@/components/ui';

interface StaffRow {
  membership_id: string;
  display_name: string;
  phone: string;
  role: 'owner' | 'barista';
  status: 'invited' | 'active' | 'revoked';
  branch_name: string | null;
  confirmed: boolean;
  stamps: number;
  rejected: number;
  flagged: number;
  redemptions: number;
  offline_redemptions: number;
}

export function StaffManager({ cafeId, staff, branches }: { cafeId: string; staff: StaffRow[]; branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: 'remove' | 'confirm', membershipId: string) {
    if (action === 'remove' && !confirm('Remove this barista? Their scanner stops working at its next sync.')) return;
    setBusy(membershipId);
    setError(null);
    try {
      await callFunction('staff-manage', { action, cafeId, membershipId });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    let phone = asciiDigits(String(f.get('phone'))).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '964' + phone.slice(1);
    if (phone.length === 10 && phone.startsWith('7')) phone = '964' + phone;
    setBusy('invite');
    setError(null);
    try {
      await callFunction('staff-manage', { action: 'invite', cafeId, phone, branchId: f.get('branch') || null });
      form.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const statusTone = { invited: 'warn', active: 'good', revoked: 'neutral' } as const;

  return (
    <div className="space-y-6">
      <form onSubmit={invite} className="card grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="phone">Barista WhatsApp number</label>
          <input id="phone" name="phone" className="input" dir="ltr" inputMode="tel" placeholder="0750 123 4567" required />
        </div>
        <div>
          <label className="label" htmlFor="branch">Branch</label>
          <select id="branch" name="branch" className="input">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={busy === 'invite'}>{busy === 'invite' ? 'Sending…' : 'Send invite'}</button>
      </form>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Branch</th><th>Status</th><th>Stamps</th><th>Rejected</th><th>Redeemed (offline)</th><th /></tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.membership_id} className={s.status === 'revoked' ? 'opacity-50' : ''}>
                <td>
                  <div className="font-medium">{s.display_name}</div>
                  <div className="text-xs text-ink-muted" dir="ltr">+{s.phone}</div>
                </td>
                <td className="capitalize">{s.role}</td>
                <td>{s.role === 'owner' ? '—' : s.branch_name ?? 'All'}</td>
                <td className="space-x-1 rtl:space-x-reverse">
                  <Badge tone={statusTone[s.status]}>{s.status}</Badge>
                  {s.role === 'barista' && s.status === 'active' && !s.confirmed && <Badge tone="warn">new</Badge>}
                </td>
                <td className="tabular-nums">{s.stamps}{s.flagged > 0 && <span className="text-warn"> ({s.flagged} flagged)</span>}</td>
                <td className="tabular-nums">{s.rejected}</td>
                <td className="tabular-nums">{s.redemptions} ({s.offline_redemptions})</td>
                <td className="whitespace-nowrap text-right rtl:text-left">
                  {s.role === 'barista' && s.status === 'active' && !s.confirmed && (
                    <button className="btn-ghost px-3 py-1.5" disabled={busy === s.membership_id} onClick={() => act('confirm', s.membership_id)}>Confirm</button>
                  )}{' '}
                  {s.role === 'barista' && s.status !== 'revoked' && (
                    <button className="btn-danger px-3 py-1.5" disabled={busy === s.membership_id} onClick={() => act('remove', s.membership_id)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

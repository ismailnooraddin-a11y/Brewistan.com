'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { timeAgo } from '@/lib/utils';
import type { Database } from '@/lib/database.types';

type Redemption = Database['public']['Tables']['reward_redemptions']['Row'] & {
  customer?: { full_name: string | null } | null;
};

export function StaffRedemptionsLive({ cafeId, initial }: { cafeId: string; initial: Redemption[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = useState<Redemption[]>(initial);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('get_cafe_pending_redemptions', { p_cafe_id: cafeId });
    if (data) setItems(data as Redemption[]);
  }, [supabase, cafeId]);

  useEffect(() => {
    const channel = supabase
      .channel(`redemptions:cafe=${cafeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reward_redemptions', filter: `cafe_id=eq.${cafeId}` },
        () => { refresh(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, cafeId, refresh]);

  async function confirm(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    const { error } = await supabase.rpc('redeem_reward', { p_redemption_id: id });
    setBusy((b) => ({ ...b, [id]: false }));
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setToast('✓ Reward confirmed.');
      setItems((prev) => prev.filter((r) => r.id !== id));
    }
    setTimeout(() => setToast(null), 3000);
    router.refresh();
  }

  const f = filter.trim().toUpperCase();
  const visible = f
    ? items.filter((r) => r.redemption_code.includes(f))
    : items;

  return (
    <>
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--olive)', color: '#fffdf8',
            padding: '12px 18px', borderRadius: 14, boxShadow: 'var(--shadow)',
            zIndex: 50, fontSize: 13, fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={16} color="var(--muted)" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by reward code (e.g. A3F92B)"
          style={{ flex: 1, border: 0, outline: 0, fontFamily: 'inherit', fontSize: 14, background: 'transparent' }}
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <h3>No rewards to confirm</h3>
          <p>When a customer reaches their stamp goal and asks to redeem, their reward will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((r) => (
            <div key={r.id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
                  Code
                </div>
                <div style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  marginTop: 2,
                }}>
                  {r.redemption_code}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {r.reward_text}
                </div>
                <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                  Earned {timeAgo(r.earned_at)}
                </div>
              </div>
              <button
                className="btn"
                disabled={busy[r.id]}
                onClick={() => confirm(r.id)}
                style={{ flexShrink: 0 }}
              >
                <Check size={14} /> {busy[r.id] ? 'Working…' : 'Confirm'}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

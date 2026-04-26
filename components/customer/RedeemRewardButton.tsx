'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Check, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { Database } from '@/lib/database.types';

type Redemption = Database['public']['Tables']['reward_redemptions']['Row'];

export function RedeemRewardButton({ redemption }: { redemption: Redemption }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Redemption['status']>(redemption.status);

  // Realtime subscription: when the barista marks this redemption "redeemed"
  // we want the customer's screen to reflect that immediately.
  useEffect(() => {
    if (status !== 'available') return;

    const channel = supabase
      .channel(`redemption:${redemption.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reward_redemptions', filter: `id=eq.${redemption.id}` },
        (payload) => {
          const next = (payload.new as Redemption).status;
          setStatus(next);
          if (next === 'redeemed') router.refresh();
        },
      )
      .subscribe();

    // Polling fallback every 5s in case realtime drops
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('reward_redemptions')
        .select('status')
        .eq('id', redemption.id)
        .maybeSingle();
      if (data && data.status !== status) {
        setStatus(data.status);
        if (data.status === 'redeemed') router.refresh();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [supabase, redemption.id, status, router]);

  if (status === 'redeemed') {
    return (
      <div className="panel alert-success" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Check size={18} color="#2c5f3a" />
        <div>
          <strong style={{ color: '#2c5f3a' }}>{redemption.reward_text}</strong>
          <div className="hint">Redeemed. Enjoy!</div>
        </div>
      </div>
    );
  }

  if (status !== 'available') {
    return (
      <div className="panel" style={{ opacity: 0.6 }}>
        <strong>{redemption.reward_text}</strong>
        <div className="hint">{status === 'expired' ? 'Expired' : 'Cancelled'}</div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn"
        style={{ justifyContent: 'space-between', width: '100%', padding: '14px 18px' }}
        onClick={() => setOpen(true)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gift size={16} /> {redemption.reward_text}
        </span>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Show code →</span>
      </button>
    );
  }

  // Open: show the redemption code at large size for the barista to read.
  return (
    <div
      className="panel"
      style={{
        textAlign: 'center',
        background: 'linear-gradient(135deg, #14251d 0%, #2a3a32 100%)',
        color: '#fffdf8',
        borderColor: 'transparent',
      }}
    >
      <div className="eyebrow" style={{ color: 'rgba(255,253,248,0.6)' }}>Show this to the barista</div>
      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 38, fontWeight: 600, letterSpacing: '0.18em', margin: '12px 0' }}>
        {redemption.redemption_code}
      </div>
      <div style={{ fontSize: 14, opacity: 0.85 }}>{redemption.reward_text}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 11.5, color: 'rgba(255,253,248,0.6)' }}>
        <Clock size={12} />
        <span>Waiting for barista to confirm…</span>
      </div>
      <button className="pill" style={{ marginTop: 14, color: '#fffdf8', borderColor: 'rgba(255,253,248,0.3)' }} onClick={() => setOpen(false)}>
        Hide code
      </button>
    </div>
  );
}

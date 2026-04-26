'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { timeAgo } from '@/lib/utils';

type PendingRequest = {
  id: string;
  requested_at: string;
  expires_at: string;
  customer_id: string;
  customer: { full_name: string } | null;
  card: {
    stamps_count: number;
    campaign: { stamps_required: number; reward_text: string } | null;
  } | null;
};

export function StampRequestsLive({
  cafeId, initialRequests,
}: { cafeId: string; initialRequests: PendingRequest[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [, tick] = useState(0);
  // Per-request inline rejection state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Refetch a single request with joined data (used when realtime fires)
  const fetchOne = useCallback(async (id: string): Promise<PendingRequest | null> => {
    const { data } = await supabase
      .from('stamp_requests')
      .select(`
        id, requested_at, expires_at, customer_id, status,
        customer:profiles ( full_name ),
        card:loyalty_cards ( stamps_count, campaign:campaigns ( stamps_required, reward_text ) )
      `)
      .eq('id', id)
      .maybeSingle();
    if (!data || data.status !== 'pending') return null;
    return data as unknown as PendingRequest;
  }, [supabase]);

  useEffect(() => {
    // Re-render every 10s so "X seconds ago" stays fresh
    const interval = setInterval(() => tick((t) => t + 1), 10_000);

    const channel = supabase
      .channel(`stamp_requests:cafe=${cafeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stamp_requests', filter: `cafe_id=eq.${cafeId}` },
        async (payload) => {
          const newRow = payload.new as { id: string; status: string };
          if (newRow.status !== 'pending') return;
          const full = await fetchOne(newRow.id);
          if (full) setRequests((prev) => (prev.some((r) => r.id === full.id) ? prev : [...prev, full]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stamp_requests', filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          if (row.status !== 'pending') {
            setRequests((prev) => prev.filter((r) => r.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [cafeId, supabase, fetchOne]);

  async function approve(id: string) {
    setProcessing((p) => ({ ...p, [id]: true }));
    const { data, error } = await supabase.rpc('approve_stamp', { p_request_id: id });
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      const reward = (data as { reward_issued?: boolean } | null)?.reward_issued;
      setToast(reward ? '🎉 Approved — customer earned a reward!' : '✓ Stamp approved.');
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setProcessing((p) => ({ ...p, [id]: false }));
    setTimeout(() => setToast(null), 3500);
    router.refresh();
  }

  async function reject(id: string, note?: string) {
    setProcessing((p) => ({ ...p, [id]: true }));
    const { error } = await supabase.rpc('reject_stamp', { p_request_id: id, p_note: note || null });
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setToast('Request rejected.');
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setProcessing((p) => ({ ...p, [id]: false }));
    setRejectingId(null);
    setRejectNote('');
    setTimeout(() => setToast(null), 3500);
    router.refresh();
  }

  function startReject(id: string) {
    setRejectingId(id);
    setRejectNote('');
  }

  function cancelReject() {
    setRejectingId(null);
    setRejectNote('');
  }

  function expiryMsLeft(iso: string) {
    return Math.max(0, new Date(iso).getTime() - Date.now());
  }

  return (
    <>
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 22,
            right: 22,
            background: 'var(--olive)',
            color: '#fffdf8',
            padding: '12px 18px',
            borderRadius: 14,
            boxShadow: 'var(--shadow)',
            zIndex: 50,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="empty">
          <h3>All caught up</h3>
          <p>No pending stamp requests. New requests appear here in realtime when customers tap <em>Request stamp</em>.</p>
        </div>
      ) : (
        <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {requests.map((r) => {
            const msLeft = expiryMsLeft(r.expires_at);
            const minsLeft = Math.ceil(msLeft / 60000);
            const stamps = r.card?.stamps_count ?? 0;
            const required = r.card?.campaign?.stamps_required ?? 0;
            const willReward = required > 0 && stamps + 1 >= required;

            return (
              <div key={r.id} className="panel" style={{ position: 'relative' }}>
                {willReward && (
                  <div style={{
                    position: 'absolute',
                    top: 14, right: 14,
                    background: 'linear-gradient(135deg, #bc8733, #e0bf71)',
                    color: '#23190a',
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    borderRadius: 999,
                  }}>
                    Reward unlock
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Pending request
                </div>
                <h3 style={{ marginTop: 6 }}>{r.customer?.full_name ?? 'Customer'}</h3>
                <p style={{ marginTop: 6 }}>
                  Stamps: <strong>{stamps} → {stamps + 1}</strong> of {required}<br />
                  Reward: {r.card?.campaign?.reward_text ?? '—'}
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  fontSize: 11.5,
                  color: msLeft < 120_000 ? '#a33a3a' : 'var(--muted)',
                }}>
                  <Clock size={12} />
                  <span>
                    {timeAgo(r.requested_at)} · expires in {minsLeft} min
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    className="btn"
                    onClick={() => approve(r.id)}
                    disabled={processing[r.id] || rejectingId === r.id}
                    style={{ flex: 1 }}
                  >
                    <Check size={14} /> {processing[r.id] ? 'Working…' : 'Approve'}
                  </button>
                  {rejectingId !== r.id && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => startReject(r.id)}
                      disabled={processing[r.id]}
                      style={{ color: '#8c2f2f' }}
                      aria-label="Reject"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {rejectingId === r.id && (
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(140, 47, 47, 0.05)', borderRadius: 12, border: '1px solid rgba(140, 47, 47, 0.18)' }}>
                    <label
                      htmlFor={`reject-${r.id}`}
                      style={{ display: 'block', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#8c2f2f', marginBottom: 6 }}
                    >
                      Reason (optional)
                    </label>
                    <input
                      id={`reject-${r.id}`}
                      type="text"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="e.g. didn't order anything"
                      autoFocus
                      maxLength={200}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: 'inherit',
                        background: 'var(--panel)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') reject(r.id, rejectNote);
                        else if (e.key === 'Escape') cancelReject();
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        className="btn"
                        onClick={() => reject(r.id, rejectNote)}
                        disabled={processing[r.id]}
                        style={{ flex: 1, background: '#8c2f2f', borderColor: '#8c2f2f' }}
                      >
                        {processing[r.id] ? 'Rejecting…' : 'Confirm reject'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={cancelReject}
                        disabled={processing[r.id]}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

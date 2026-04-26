'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type Phase = 'idle' | 'submitting' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error';

export function CustomerStampButton({ cafeSlug, cafeName }: { cafeSlug: string; cafeName: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function submit() {
    setPhase('submitting');
    setMessage(null);
    const { data, error } = await supabase.rpc('request_stamp', { p_cafe_slug: cafeSlug });
    if (error) {
      setPhase('error');
      setMessage(
        error.message.includes('NO_ACTIVE_CAMPAIGN')
          ? 'This café has no active campaign right now.'
          : error.message.includes('CAFE_NOT_FOUND')
            ? 'We could not find this café.'
            : error.message,
      );
      return;
    }
    setRequestId(data as unknown as string);
    setPhase('pending');
  }

  useEffect(() => {
    if (phase !== 'pending' || !requestId) return;

    const channel = supabase
      .channel(`stamp_request:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stamp_requests', filter: `id=eq.${requestId}` },
        (payload) => {
          const row = payload.new as { status: string };
          if (row.status === 'approved') {
            setPhase('approved');
            setMessage('Stamp approved!');
            router.refresh();
          } else if (row.status === 'rejected') {
            setPhase('rejected');
            setMessage('Request was rejected by the barista.');
          } else if (row.status === 'expired') {
            setPhase('expired');
            setMessage('Request expired. Please try again.');
          }
        },
      )
      .subscribe();

    // Belt-and-suspenders: poll every 4s in case realtime drops
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('stamp_requests')
        .select('status')
        .eq('id', requestId)
        .maybeSingle();
      if (data && data.status !== 'pending') {
        if (data.status === 'approved') { setPhase('approved'); setMessage('Stamp approved!'); router.refresh(); }
        else if (data.status === 'rejected') { setPhase('rejected'); setMessage('Request was rejected.'); }
        else if (data.status === 'expired') { setPhase('expired'); setMessage('Request expired.'); }
      }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [phase, requestId, supabase, router]);

  if (phase === 'approved') {
    return (
      <div className="panel alert-success" style={{ marginTop: 14, borderColor: '#d3ebd6' }}>
        <h3 style={{ color: '#2c5f3a' }}>✓ Stamp added</h3>
        <p>Your card at {cafeName} has been updated. Enjoy your coffee!</p>
      </div>
    );
  }

  if (phase === 'pending') {
    return (
      <div className="panel" style={{ marginTop: 14, textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, margin: '0 auto 12px',
          border: '3px solid var(--line-strong)', borderTopColor: 'var(--olive)',
          borderRadius: '50%',
          animation: 'spin 900ms linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h3>Waiting for barista approval</h3>
        <p>Show this screen at the counter. Your stamp will appear as soon as the barista approves.</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
          <Clock size={12} /> Expires in 15 minutes
        </div>
      </div>
    );
  }

  if (phase === 'rejected' || phase === 'expired' || phase === 'error') {
    return (
      <div className="panel alert-error" style={{ marginTop: 14 }}>
        <h3 style={{ color: '#8c2f2f' }}>{phase === 'rejected' ? 'Not approved' : phase === 'expired' ? 'Expired' : 'Something went wrong'}</h3>
        <p>{message}</p>
        <button className="btn btn-secondary" style={{ marginTop: 10 }}
          onClick={() => { setPhase('idle'); setMessage(null); setRequestId(null); }}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button className="btn" onClick={submit} disabled={phase === 'submitting'} style={{ width: '100%', justifyContent: 'center', padding: '14px 20px' }}>
        {phase === 'submitting' ? 'Sending request…' : 'Request stamp from barista'}
      </button>
      <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
        After you order, tap here to request your stamp. The barista will approve it.
      </p>
    </div>
  );
}

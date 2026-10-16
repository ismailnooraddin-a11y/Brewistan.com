'use client';

import { asciiDigits, baghdadToIso } from '@/lib/validation';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callFunction, createClient } from '@/lib/supabase/client';
import { Badge, formatDate } from '@/components/ui';

interface Campaign {
  id: string;
  title: Record<string, string>;
  body: Record<string, string>;
  scheduled_at: string;
  status: 'draft' | 'approved' | 'sending' | 'sent' | 'cancelled';
  audience_count: number | null;
  delivered_count: number | null;
}

export function PushComposer({ cafeId, campaigns }: { cafeId: string; campaigns: Campaign[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState<{ id: string; audience: number } | null>(null);
  const [code, setCode] = useState('');

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    const pick = (k: string) => String(f.get(k) ?? '').trim();
    try {
    const { error } = await createClient().from('push_campaigns').insert({
      cafe_id: cafeId,
      title: { en: pick('title_en'), ar: pick('title_ar'), ckb: pick('title_ckb') },
      body: { en: pick('body_en'), ar: pick('body_ar'), ckb: pick('body_ckb') },
      scheduled_at: baghdadToIso(pick('at')),
    });
    setBusy(false);
    if (error) setError(error.message.replace(/^[a-z_]+: /, ''));
    else {
      form.reset();
      router.refresh();
    }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the draft.'); }
    finally { setBusy(false); }
  }

  async function requestCode(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await callFunction<{ audience: number }>('push-approve', { action: 'request', campaignId: id });
      setApproving({ id, audience: r.audience });
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!approving || busy) return;
    setBusy(true);
    try {
      await callFunction('push-approve', { action: 'verify', campaignId: approving.id, code });
      setApproving(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { error } = await createClient().from('push_campaigns').update({ status: 'cancelled' }).eq('id', id).eq('status','draft').select('id').single();
      if (error) setError('The draft changed or could not be cancelled. Refresh and retry.');
      else router.refresh();
    } catch { setError('Could not cancel. Please retry.'); }
    finally { setBusy(false); }
  }

  const tone = { draft: 'neutral', approved: 'gold', sending: 'warn', sent: 'good', cancelled: 'neutral' } as const;

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card space-y-4">
        <h2 className="text-lg">New campaign</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm"><span className="label">Title (English)</span><input name="title_en" className="input" placeholder="Title (English)" required maxLength={60} /></label>
          <label className="block text-sm"><span className="label">Title (Arabic)</span><input name="title_ar" className="input" dir="rtl" placeholder="العنوان" maxLength={60} /></label>
          <label className="block text-sm"><span className="label">Title (Sorani)</span><input name="title_ckb" className="input" dir="rtl" placeholder="سەردێڕ" maxLength={60} /></label>
          <label className="block text-sm"><span className="label">Message (English)</span><textarea name="body_en" className="input" rows={3} placeholder="Message (English)" required maxLength={240} /></label>
          <label className="block text-sm"><span className="label">Message (Arabic)</span><textarea name="body_ar" className="input" dir="rtl" rows={3} placeholder="الرسالة" maxLength={240} /></label>
          <label className="block text-sm"><span className="label">Message (Sorani)</span><textarea name="body_ckb" className="input" dir="rtl" rows={3} placeholder="پەیام" maxLength={240} /></label>
        </div>
        <div className="max-w-xs">
          <label className="label" htmlFor="at">Send at (Baghdad time)</label>
          <input id="at" name="at" type="datetime-local" className="input" required />
        </div>
        <button className="btn-primary" disabled={busy}>Save draft</button>
      </form>

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}

      {approving && (
        <div className="card border-gold">
          <h2 className="text-lg">Approve with WhatsApp code</h2>
          <p className="mt-1 text-sm text-ink-muted">This will reach about {approving.audience} customers. Enter the code we just sent to your WhatsApp. It expires in 5 minutes.</p>
          <div className="mt-4 flex max-w-sm gap-3">
            <input aria-label="WhatsApp approval code" autoComplete="one-time-code" className="input min-w-0 flex-1 text-center tracking-[0.4em]" dir="ltr" inputMode="numeric" maxLength={6}
              value={code} onChange={(e) => setCode(asciiDigits(e.target.value).replace(/\D/g, ''))} />
            <button className="btn-gold" disabled={busy || code.length !== 6} onClick={verify}>Approve</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead><tr><th>Message</th><th>Send time</th><th>Status</th><th>Reach</th><th /></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td><div className="font-medium">{c.title.en}</div><div className="text-xs text-ink-muted">{c.body.en}</div></td>
                <td>{formatDate(c.scheduled_at, true)}</td>
                <td><Badge tone={tone[c.status]}>{c.status}</Badge></td>
                <td className="tabular-nums">{c.status === 'sent' ? `${c.delivered_count ?? 0} accepted by FCM` : c.audience_count ?? '—'}</td>
                <td className="whitespace-nowrap text-right rtl:text-left">
                  {c.status === 'draft' && (
                    <>
                      <button className="btn-gold px-3 py-1.5" disabled={busy} onClick={() => requestCode(c.id)}>Approve</button>{' '}
                      <button className="btn-ghost px-3 py-1.5" disabled={busy} onClick={() => cancel(c.id)}>Cancel</button>
                    </>
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

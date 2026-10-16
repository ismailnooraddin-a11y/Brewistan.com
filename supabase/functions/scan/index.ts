// Two-phase online scan: side-effect-free preview, then an explicit event-ID mutation.
import { handler, HttpError, json, optionalUuid, readJson, requireUuid } from '../_shared/http.ts';
import { requireUser } from '../_shared/supabase.ts';
import { applyScan, customerSummary, requireActiveScanner, verifiedCustomer } from '../_shared/scan.ts';

interface Body {
  qr: string;
  cafeId: string;
  branchId?: string | null;
  action: 'auto' | 'preview' | 'stamp' | 'redeem';
  eventId: string;
  rewardId?: string | null;
}

Deno.serve(handler(async (req) => {
  const { user } = await requireUser(req);
  const body = await readJson<Body>(req);
  const cafeId = requireUuid(body.cafeId, 'cafe');
  const branchId = optionalUuid(body.branchId, 'branch');
  const eventId = requireUuid(body.eventId, 'event');
  if (!['auto', 'preview', 'stamp', 'redeem'].includes(body.action)) throw new HttpError(400, 'invalid_action');
  if (body.action === 'auto') throw new HttpError(426, 'client_upgrade_required', 'Update the scanner app before recording another scan.');
  const now = Date.now();
  if (body.action === 'preview') {
    await requireActiveScanner(user.id, cafeId, branchId, now);
    const parsed = await verifiedCustomer(body.qr, now);
    if (parsed.cert.u === user.id) throw new HttpError(403, 'self_scan');
    const summary = await customerSummary(parsed.cert.u, cafeId);
    return json({ prompt: summary.availableRewardId ? 'redeem' : 'stamp', ...summary });
  }

  const type = body.action === 'redeem' ? 'redeem' : 'stamp';
  const result = await applyScan({
    qr: body.qr,
    cafeId,
    branchId,
    staffId: user.id,
    eventId,
    atMs: now,
    offline: false,
    type,
    rewardId: optionalUuid(body.rewardId, 'reward'),
  });
  const summary = await customerSummary(result.userId, cafeId).catch(() => ({ customerName: '', rewardLabel: { en: 'Free Coffee' } }));
  const { userId: _hidden, ...publicResult } = result;
  return json({ type, ...publicResult, customerName: summary.customerName, rewardLabel: summary.rewardLabel });
}));

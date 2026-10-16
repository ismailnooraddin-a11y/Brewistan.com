// Uploads scans queued offline. Events are idempotent by id and processed in
// scan-time order so the cooldown and reward rules match what happened at the counter.
import { handler, HttpError, json, optionalUuid, readJson, requireUuid } from '../_shared/http.ts';
import { requireUser } from '../_shared/supabase.ts';
import { requireCurrentQueueFormat } from '../_shared/validation.ts';
import { applyScan } from '../_shared/scan.ts';

interface QueuedEvent {
  eventId: string;
  type: 'stamp' | 'redeem';
  qr: string;
  cafeId: string;
  branchId?: string | null;
  scannedAt: string;
  rewardId?: string | null;
  snapshot: string;
  scannerDeviceId: string;
  staffId: string;
}

const MAX_BATCH = 200;

Deno.serve(handler(async (req) => {
  const { user } = await requireUser(req);
  const { events } = await readJson<{ events: QueuedEvent[] }>(req);
  if (!Array.isArray(events) || events.length === 0) throw new HttpError(400, 'no_events');
  if (events.length > MAX_BATCH) throw new HttpError(400, 'batch_too_large');

  if (events.some((e) => !e || typeof e !== 'object')) throw new HttpError(400, 'invalid_event');
  requireCurrentQueueFormat(events); // Whole-request error preserves old clients' pending rows.
  const sorted = [...events].sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));
  const results: { eventId: string; status: string; reason?: string | null; final: boolean }[] = [];

  for (const ev of sorted) {
    let eventId = '';
    try {
      eventId = requireUuid(ev.eventId, 'event');
      if (ev.staffId !== user.id) throw new HttpError(403, 'queue_account_mismatch');
      const at = Date.parse(ev.scannedAt);
      if (!Number.isFinite(at)) throw new HttpError(400, 'invalid_time');
      if (ev.type !== 'stamp' && ev.type !== 'redeem') throw new HttpError(400, 'invalid_type');

      const r = await applyScan({
        qr: ev.qr,
        snapshot: ev.snapshot,
        scannerDeviceId: requireUuid(ev.scannerDeviceId, 'scanner_device'),
        cafeId: requireUuid(ev.cafeId, 'cafe'),
        branchId: optionalUuid(ev.branchId, 'branch'),
        staffId: user.id,
        eventId,
        atMs: at,
        offline: true,
        type: ev.type,
        rewardId: optionalUuid(ev.rewardId, 'reward'),
      });
      results.push({ eventId, status: r.status, reason: r.reason ?? null, final: true });
    } catch (e) {
      if (e instanceof HttpError && e.status < 500 && e.status !== 429 && e.status !== 408) {
        // Validation failures are final: retain their reason locally, then remove QR payloads.
        results.push({ eventId: eventId || String(ev.eventId), status: 'rejected', reason: e.code, final: true });
      } else {
        console.error('sync event failed');
        results.push({ eventId: eventId || String(ev.eventId), status: 'retry', reason: 'server_error', final: false });
      }
    }
  }

  return json({ results, serverTime: Date.now() });
}));

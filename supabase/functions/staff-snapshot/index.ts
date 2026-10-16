// Signed barista membership snapshot. The scanner works offline for 72 hours
// on this snapshot, then locks until it syncs again.
import { handler, json, readJson, requireUuid, HttpError } from '../_shared/http.ts';
import { admin, requireUser } from '../_shared/supabase.ts';
import { signToken } from '../_shared/crypto.ts';

const VALID_HOURS = 72;

Deno.serve(handler(async (req) => {
  const { user } = await requireUser(req);
  const body = await readJson<{ scannerDeviceId: string }>(req);
  if (!body.scannerDeviceId) throw new HttpError(426, 'client_upgrade_required');
  const deviceId = requireUuid(body.scannerDeviceId, 'scanner_device');
  const { data: device, error: deviceError } = await admin.from('devices').select('id').eq('id',deviceId).eq('user_id',user.id).is('revoked_at',null).maybeSingle();
  if (deviceError) throw deviceError;
  if (!device) throw new HttpError(403, 'scanner_device_invalid');

  const { data: m, error } = await admin.rpc('staff_snapshot_data',{p_user:user.id});
  if(error) throw error;
  // Refuse an unmanageable signed snapshot instead of silently truncating authority.
  if(JSON.stringify(m).length>200000) throw new HttpError(409,'staff_scope_too_large');

  const now = Date.now();
  const snapshot = await signToken({ t: 'ss', u: user.id, d: deviceId, m, e: Math.floor(now / 1000) + VALID_HOURS * 3600, s: now });
  if(snapshot.length>16000) throw new HttpError(409,'staff_scope_too_large');
  return json({ snapshot, isStaff: m.length > 0, serverTime: now });
}));

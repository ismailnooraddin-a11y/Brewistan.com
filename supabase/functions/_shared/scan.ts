import { HttpError } from './http.ts';
import { admin } from './supabase.ts';
import { verifyCustomerQr, verifyToken } from './crypto.ts';

export interface ScanInput {
  qr: string;
  cafeId: string;
  branchId: string | null;
  staffId: string;
  eventId: string;
  atMs: number;
  offline: boolean;
  type: 'stamp' | 'redeem';
  rewardId?: string | null;
  snapshot?: string;
  scannerDeviceId?: string;
}

export interface ScanResult {
  status: string;
  reason?: string | null;
  userId: string;
  [key: string]: unknown;
}

export async function requireActiveScanner(staffId: string, cafeId: string, branchId: string | null, atMs: number): Promise<void> {
  if (!branchId) throw new HttpError(400, 'branch_required');
  const { data, error } = await admin.rpc('barista_membership', {
    p_cafe: cafeId, p_staff: staffId, p_branch: branchId, p_at: new Date(atMs).toISOString(),
  });
  if (error) throw error;
  if (!data?.length || data[0].status !== 'active') throw new HttpError(403, 'not_staff');
  const { data: branch, error: branchError } = await admin.from('branches').select('id')
    .eq('id', branchId).eq('cafe_id', cafeId).eq('active', true).maybeSingle();
  if (branchError) throw branchError;
  if (!branch) throw new HttpError(403, 'branch_mismatch');
}

interface StaffToken { t: string; u: string; d: string; s: number; e: number; m: { c: string; b: { i: string }[] }[] }
export async function verifyOfflineAuthorization(input: ScanInput): Promise<void> {
  const token = await verifyToken<StaffToken>(input.snapshot ?? '');
  if (!token || token.t !== 'ss' || token.u !== input.staffId || token.d !== input.scannerDeviceId ||
      !Number.isSafeInteger(token.s) || !Number.isSafeInteger(token.e) ||
      input.atMs < token.s || input.atMs >= token.e * 1000 || token.e * 1000 - token.s > 72 * 3600_000 || !Array.isArray(token.m)) {
    throw new HttpError(403, 'invalid_staff_snapshot');
  }
  const cafe = token.m.find((m) => m.c === input.cafeId);
  if (!cafe || !Array.isArray(cafe.b) || !cafe.b.some((b) => b.i === input.branchId)) throw new HttpError(403, 'branch_mismatch');
  const { data: device, error } = await admin.from('devices').select('id').eq('id', token.d).eq('user_id', input.staffId).is('revoked_at', null).maybeSingle();
  if (error) throw error;
  if (!device) throw new HttpError(403, 'scanner_device_invalid');
}

export async function verifiedCustomer(qr: string, atMs: number) {
  const parsed = await verifyCustomerQr(qr, atMs);
  const { data: device, error } = await admin.from('devices').select('id,user_id,public_key,revoked_at').eq('id', parsed.cert.d).maybeSingle();
  if (error) throw error;
  if (!device || device.user_id !== parsed.cert.u || device.public_key !== parsed.cert.k) throw new HttpError(403, 'device_unknown');
  if (device.revoked_at && Date.parse(device.revoked_at) <= atMs) throw new HttpError(403, 'device_revoked');
  return parsed;
}

/** Verifies the customer QR at the scan time and applies the stamp or redemption. */
export async function applyScan(input: ScanInput): Promise<ScanResult> {
  const { data: existing, error: lookupError } = await admin.rpc('lookup_scan_event', {
    p_id: input.eventId, p_staff: input.staffId, p_cafe: input.cafeId, p_branch: input.branchId, p_type: input.type,
  });
  if (lookupError) { if (lookupError.code === '22023') throw new HttpError(409, 'event_conflict'); throw lookupError; }
  if (existing) return existing as ScanResult;
  if (input.offline) {
    if (input.atMs>Date.now()+5*60_000) throw new HttpError(400,'scan_in_future');
    if (input.atMs<Date.now()-7*86400_000) throw new HttpError(400,'scan_too_old');
  }
  if (input.offline) await verifyOfflineAuthorization(input);
  else await requireActiveScanner(input.staffId, input.cafeId, input.branchId, input.atMs);
  const parsed = await verifiedCustomer(input.qr, input.atMs);

  const at = new Date(input.atMs).toISOString();

  if (input.type === 'stamp') {
    const { data, error } = await admin.rpc('process_stamp', {
      p_event_id: input.eventId,
      p_user_id: parsed.cert.u,
      p_cafe_id: input.cafeId,
      p_branch_id: input.branchId,
      p_staff_id: input.staffId,
      p_customer_device_id: parsed.cert.d,
      p_scanned_at: at,
      p_offline: input.offline,
    });
    if (error) { if (error.code === '22023') throw new HttpError(409, error.message); throw error; }
    return { ...(data as Record<string, unknown>), userId: parsed.cert.u } as ScanResult;
  }

  const voucherReward = parsed.voucher && parsed.voucher.c === input.cafeId ? parsed.voucher.r : null;
  if (input.offline && (!voucherReward || (input.rewardId && input.rewardId !== voucherReward))) {
    throw new HttpError(400, 'voucher_required');
  }
  const { data, error } = await admin.rpc('process_redemption_secure', {
    p_redemption_id: input.eventId,
    p_reward_id: input.offline ? voucherReward : input.rewardId ?? voucherReward,
    p_scanner_device_id: input.scannerDeviceId ?? null,
    p_user_id: parsed.cert.u,
    p_cafe_id: input.cafeId,
    p_branch_id: input.branchId,
    p_staff_id: input.staffId,
    p_redeemed_at: at,
    p_offline: input.offline,
  });
  if (error) { if (error.code === '22023') throw new HttpError(409, error.message); throw error; }
  return { ...(data as Record<string, unknown>), userId: parsed.cert.u } as ScanResult;
}

export async function customerSummary(userId: string, cafeId: string) {
  const [profileResult, rewardResult] = await Promise.all([
    admin.from('profiles').select('first_name,last_name').eq('id',userId).maybeSingle(),
    admin.from('rewards').select('id,campaign_id').eq('user_id',userId).eq('cafe_id',cafeId).eq('status','available')
      .gt('expires_at',new Date().toISOString()).order('issued_at').limit(1).maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (rewardResult.error) throw rewardResult.error;
  const profile = profileResult.data, reward = rewardResult.data;
  let label = { en: 'Free Coffee' };
  if (reward) {
    const { data, error } = await admin.from('campaigns').select('reward_label').eq('id',reward.campaign_id).single();
    if (error) throw error;
    label = data.reward_label;
  }
  const first = profile?.first_name?.trim() || 'Guest';
  const last = profile?.last_name?.trim() || '';
  return { customerName: last ? `${first} ${[...last][0].toUpperCase()}.` : first,
    availableRewardId: reward?.id ?? null, rewardLabel: label };
}

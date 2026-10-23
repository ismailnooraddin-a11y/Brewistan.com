// Brewistan customer QR and device-registration protocol (browser side).
// Must match supabase/functions/_shared/crypto.ts and device-proof.ts exactly;
// supabase/functions/_tests/web_protocol_test.ts checks this against the server code.

import { asciiDigits } from '@/lib/validation';

export const QR_WINDOW_SECONDS = 30;

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function qrWindow(nowMs: number): number {
  return Math.floor(nowMs / 1000 / QR_WINDOW_SECONDS);
}

/** Customer QR: BW1~<deviceCert>~<window>~<voucher|0>~<signature over everything before it>. */
export async function buildCustomerQr(
  cert: string,
  nowMs: number,
  sign: (message: Uint8Array) => Promise<Uint8Array>,
  voucher = '0',
): Promise<string> {
  const signedPart = `BW1~${cert}~${qrWindow(nowMs)}~${voucher}`;
  const signature = await sign(new TextEncoder().encode(signedPart));
  return `${signedPart}~${b64urlEncode(signature)}`;
}

export interface RegistrationContext {
  userId: string;
  sessionId: string;
  publicKey: string;
  platform: string;
  deviceId?: string | null;
  pushToken?: string | null;
  proofAt: number;
}

export function registrationMessage(c: RegistrationContext): string {
  return JSON.stringify(['BW-REGISTER-1', c.userId, c.sessionId, c.publicKey, c.platform, c.deviceId ?? null, c.pushToken ?? null, c.proofAt]);
}

/** The Supabase session id inside an access token (needed for the registration proof). */
export function sessionIdFromAccessToken(token: string): string | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(token.split('.')[1] ?? '')));
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

/** Iraqi numbers by default: 0750 123 4567, 750 123 4567, +964 750..., 00964 750... -> +9647501234567. */
export function toE164(input: string): string | null {
  let d = asciiDigits(input).replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('964')) d = d.slice(3);
  return /^7\d{9}$/.test(d) ? '+964' + d : null;
}

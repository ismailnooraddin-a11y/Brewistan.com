import { HttpError } from './http.ts';

const te = new TextEncoder();
const td = new TextDecoder();

export const b64url = {
  encode(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str: string): Uint8Array {
    if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str) || str.length % 4 === 1) throw new Error('invalid_base64url');
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

function platformSeed(): Uint8Array {
  const seed = Deno.env.get('PLATFORM_SIGNING_SEED');
  if (!seed) throw new Error('PLATFORM_SIGNING_SEED is not set');
  const bytes = b64url.decode(seed);
  if (bytes.length !== 32) throw new Error('PLATFORM_SIGNING_SEED must be 32 bytes (base64url)');
  return bytes;
}

let cachedSigningKey: CryptoKey | null = null;
let cachedPublicKey: Uint8Array | null = null;
async function signingKey(): Promise<CryptoKey> {
  if (!cachedSigningKey) {
    // RFC 8410 PKCS#8 prefix for a raw 32-byte Ed25519 seed.
    const prefix = new Uint8Array([48,46,2,1,0,48,5,6,3,43,101,112,4,34,4,32]);
    const der = new Uint8Array(48); der.set(prefix); der.set(platformSeed(),16);
    cachedSigningKey = await crypto.subtle.importKey('pkcs8', der, 'Ed25519', true, ['sign']);
  }
  return cachedSigningKey;
}
export async function platformPublicKey(): Promise<Uint8Array> {
  if (!cachedPublicKey) {
    const jwk = await crypto.subtle.exportKey('jwk', await signingKey());
    if (!jwk.x) throw new Error('invalid_platform_key');
    cachedPublicKey = b64url.decode(jwk.x);
  }
  return cachedPublicKey;
}
export async function verifyEd25519(sig: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
  try {
    if (sig.length !== 64 || publicKey.length !== 32) return false;
    // Copies give WebCrypto plain ArrayBuffer-backed views (required by newer TypeScript typings).
    const key = await crypto.subtle.importKey('raw', new Uint8Array(publicKey), 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, new Uint8Array(sig), new Uint8Array(message));
  } catch { return false; }
}
export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const body = b64url.encode(te.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', await signingKey(), te.encode(body)));
  return `${body}.${b64url.encode(sig)}`;
}
export async function verifyToken<T>(token: string): Promise<T | null> {
  try {
    if (typeof token !== 'string' || token.length > 16000) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [body, sig] = parts;
    if (!await verifyEd25519(b64url.decode(sig), te.encode(body), await platformPublicKey())) return null;
    const value: unknown = JSON.parse(td.decode(b64url.decode(body)));
    return value && typeof value === 'object' && !Array.isArray(value) ? value as T : null;
  } catch { return null; }
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', te.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomDigits(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 32) throw new RangeError('invalid_length');
  let result = '';
  while (result.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n))) {
      // Rejection sampling avoids the 0..5 modulo bias.
      if (b < 250 && result.length < n) result += String(b % 10);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Token types. The "t" tag stops one kind of token being used as another.
// ---------------------------------------------------------------------------

export interface DeviceCert {
  t: 'dc';
  u: string; // user id
  d: string; // device id
  k: string; // device public key, base64url
  e: number; // expiry, unix seconds
}

export interface RewardVoucher {
  t: 'rv';
  r: string; // reward id
  u: string; // user id
  c: string; // cafe id
  e: number;
}

export interface ParsedQr {
  cert: DeviceCert;
  window: number;
  voucher: RewardVoucher | null;
}

/**
 * Customer QR format: BW1~<deviceCert>~<window>~<voucher|0>~<deviceSignature>
 * window = floor(unixSeconds / 30). The device signs everything before the last "~".
 */
export async function verifyCustomerQr(qr: string, atMs: number): Promise<ParsedQr> {
  if (typeof qr !== 'string' || qr.length > 8192 || !Number.isFinite(atMs)) throw new HttpError(400, 'invalid_qr');
  const parts = qr.trim().split('~');
  if (parts.length !== 5 || parts[0] !== 'BW1') throw new HttpError(400, 'invalid_qr');
  const [prefix, certToken, windowStr, voucherToken, sig] = parts;

  const cert = await verifyToken<DeviceCert>(certToken);
  if (!cert || cert.t !== 'dc' || typeof cert.u !== 'string' || typeof cert.d !== 'string' || typeof cert.k !== 'string' || !Number.isSafeInteger(cert.e)) throw new HttpError(400, 'invalid_qr');
  if (cert.e * 1000 <= atMs) throw new HttpError(400, 'cert_expired');

  const signed = te.encode(`${prefix}~${certToken}~${windowStr}~${voucherToken}`);
  let ok = false;
  try { ok = await verifyEd25519(b64url.decode(sig), signed, b64url.decode(cert.k)); } catch { /* malformed input */ }
  if (!ok) throw new HttpError(400, 'invalid_qr');

  const window = Number(windowStr);
  const expected = Math.floor(atMs / 1000 / 30);
  if (!Number.isInteger(window) || Math.abs(window - expected) > 1) throw new HttpError(400, 'qr_expired');

  let voucher: RewardVoucher | null = null;
  if (voucherToken !== '0') {
    const v = await verifyToken<RewardVoucher>(voucherToken);
    if (v && v.t === 'rv' && typeof v.r === 'string' && typeof v.c === 'string' && v.u === cert.u && Number.isSafeInteger(v.e) && v.e * 1000 > atMs) voucher = v;
  }
  return { cert, window, voucher };
}

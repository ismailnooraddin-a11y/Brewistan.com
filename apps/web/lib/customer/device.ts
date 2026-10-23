'use client';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { b64urlDecode, b64urlEncode, buildCustomerQr, registrationMessage, sessionIdFromAccessToken } from './protocol';
import { callFunction, CustomerApiError, customerClient } from './supabase';

// This phone's signing key and certificate. The private key never leaves the browser;
// the server certifies the public key for 30 days and the QR is signed with it.
const STORE = 'bw.device.v1';

interface DeviceState {
  seed: string;
  publicKey: string;
  userId?: string;
  deviceId?: string;
  cert?: string;
  certExpiresAt?: string;
  clockOffsetMs?: number;
}

function load(): DeviceState | null {
  try { return JSON.parse(localStorage.getItem(STORE) ?? 'null'); } catch { return null; }
}
function save(state: DeviceState) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

async function freshKeys(): Promise<DeviceState> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const state = { seed: b64urlEncode(seed), publicKey: b64urlEncode(await getPublicKeyAsync(seed)) };
  save(state);
  return state;
}

export function serverNow(): number {
  return Date.now() + (load()?.clockOffsetMs ?? 0);
}

/** Registers this browser for the signed-in customer when needed. Safe to call often. */
export async function ensureDevice(userId: string, locale: string): Promise<void> {
  let state = load() ?? await freshKeys();
  const valid = state.userId === userId && state.cert && state.certExpiresAt &&
    Date.parse(state.certExpiresAt) - Date.now() > 3 * 86_400_000;
  if (valid) return;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: { session } } = await customerClient().auth.getSession();
    const sessionId = session ? sessionIdFromAccessToken(session.access_token) : null;
    if (!session || !sessionId) throw new CustomerApiError('not_signed_in');
    const deviceId = state.userId === userId ? state.deviceId ?? null : null;
    const proofAt = serverNow();
    const message = registrationMessage({ userId, sessionId, publicKey: state.publicKey, platform: 'web', deviceId, pushToken: null, proofAt });
    const proof = b64urlEncode(await signAsync(new TextEncoder().encode(message), b64urlDecode(state.seed)));
    try {
      const res = await callFunction<{ deviceId: string; cert: string; certExpiresAt: string; serverTime: number }>('device-register', {
        proof, proofAt, publicKey: state.publicKey, platform: 'web', deviceId, pushToken: null, appVersion: 'web-1', locale,
      });
      save({ ...state, userId, deviceId: res.deviceId, cert: res.cert, certExpiresAt: res.certExpiresAt, clockOffsetMs: res.serverTime - Date.now() });
      return;
    } catch (e) {
      // A removed device or a key from another account: start again with a fresh key.
      if (attempt === 0 && e instanceof CustomerApiError && /device|revoked|unknown/.test(e.code)) {
        state = await freshKeys();
        continue;
      }
      throw e;
    }
  }
}

/** The QR the barista scans. Changes every 30 seconds. */
export async function currentQr(): Promise<string | null> {
  const state = load();
  if (!state?.cert) return null;
  const seed = b64urlDecode(state.seed);
  return buildCustomerQr(state.cert, serverNow(), (m) => signAsync(m, seed));
}

export function forgetDevice() {
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}

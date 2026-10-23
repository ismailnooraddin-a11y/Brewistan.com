// The browser customer app must produce QR codes and registration proofs that the
// server accepts. This runs the web app's protocol code against the server's own checks.
import { deepStrictEqual as assertEquals } from 'node:assert/strict';
import { getPublicKeyAsync, signAsync } from 'npm:@noble/ed25519@2.3.0';
import { b64url, signToken, verifyCustomerQr } from '../_shared/crypto.ts';
import { registrationMessage as serverMessage } from '../_shared/device-proof.ts';
import { buildCustomerQr, registrationMessage, sessionIdFromAccessToken, toE164 } from '../../../apps/web/lib/customer/protocol.ts';

if (!Deno.env.get('PLATFORM_SIGNING_SEED')) {
  Deno.env.set('PLATFORM_SIGNING_SEED', b64url.encode(crypto.getRandomValues(new Uint8Array(32))));
}

Deno.test('a QR built by the web app is accepted by the server', async () => {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = b64url.encode(await getPublicKeyAsync(seed));
  const now = Date.now();
  const cert = await signToken({ t: 'dc', u: 'user-1', d: 'device-1', k: publicKey, e: Math.floor(now / 1000) + 3600 });
  const qr = await buildCustomerQr(cert, now, (m) => signAsync(m, seed));
  const parsed = await verifyCustomerQr(qr, now);
  assertEquals(parsed.cert.u, 'user-1');
  assertEquals(parsed.voucher, null);
});

Deno.test('a QR signed with another key is rejected', async () => {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const other = crypto.getRandomValues(new Uint8Array(32));
  const now = Date.now();
  const cert = await signToken({ t: 'dc', u: 'user-1', d: 'device-1', k: b64url.encode(await getPublicKeyAsync(seed)), e: Math.floor(now / 1000) + 3600 });
  const qr = await buildCustomerQr(cert, now, (m) => signAsync(m, other));
  let rejected = false;
  try { await verifyCustomerQr(qr, now); } catch { rejected = true; }
  assertEquals(rejected, true);
});

Deno.test('the web registration message matches the server exactly', () => {
  const c = { userId: 'u', sessionId: 's', publicKey: 'k', platform: 'web', deviceId: null, pushToken: null, proofAt: 1700000000000 };
  assertEquals(registrationMessage(c), serverMessage(c));
});

Deno.test('session id is read from the access token', () => {
  const payload = b64url.encode(new TextEncoder().encode(JSON.stringify({ session_id: 'abc-123' })));
  assertEquals(sessionIdFromAccessToken(`x.${payload}.y`), 'abc-123');
});

Deno.test('Iraqi phone numbers are normalised', () => {
  assertEquals(toE164('0750 448 7959'), '+9647504487959');
  assertEquals(toE164('750 448 7959'), '+9647504487959');
  assertEquals(toE164('+964 750 448 7959'), '+9647504487959');
  assertEquals(toE164('00964 7504487959'), '+9647504487959');
  assertEquals(toE164('+420 777 123 456'), '+420777123456');
  assertEquals(toE164('123'), null);
});

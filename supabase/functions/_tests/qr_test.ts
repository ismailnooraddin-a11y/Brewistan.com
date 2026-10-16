// deno test --allow-env supabase/functions/_tests/qr_test.ts
import { deepStrictEqual as assertEquals, rejects as assertRejects } from 'node:assert/strict';

const seed = crypto.getRandomValues(new Uint8Array(32));
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
Deno.env.set('PLATFORM_SIGNING_SEED', b64(seed));

const { signToken, verifyCustomerQr, b64url } = await import('../_shared/crypto.ts');
const te = new TextEncoder();

async function buildQr(atMs: number, voucher = '0') {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const devicePub = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  const cert = await signToken({ t: 'dc', u: 'user-1', d: 'device-1', k: b64url.encode(devicePub), e: Math.floor(atMs / 1000) + 3600 });
  const window = Math.floor(atMs / 1000 / 30);
  const signed = `BW1~${cert}~${window}~${voucher}`;
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', keys.privateKey, te.encode(signed)));
  return `${signed}~${b64url.encode(sig)}`;
}

Deno.test('valid QR verifies', async () => {
  const now = Date.now();
  const parsed = await verifyCustomerQr(await buildQr(now), now);
  assertEquals(parsed.cert.u, 'user-1');
  assertEquals(parsed.voucher, null);
});

Deno.test('QR older than one window is rejected', async () => {
  const now = Date.now();
  const qr = await buildQr(now - 95_000);
  await assertRejects(() => verifyCustomerQr(qr, now));
});

Deno.test('tampered QR is rejected', async () => {
  const now = Date.now();
  const qr = (await buildQr(now)).replace('BW1~', 'BW1~x');
  await assertRejects(() => verifyCustomerQr(qr, now));
});

Deno.test('voucher for the same user is accepted', async () => {
  const now = Date.now();
  const voucher = await signToken({ t: 'rv', r: 'reward-1', u: 'user-1', c: 'cafe-1', e: Math.floor(now / 1000) + 3600 });
  const parsed = await verifyCustomerQr(await buildQr(now, voucher), now);
  assertEquals(parsed.voucher?.r, 'reward-1');
});

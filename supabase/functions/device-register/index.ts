import { registrationMessage,registrationTimeValid } from '../_shared/device-proof.ts';
// Registers (or renews) the app install's Ed25519 public key and returns a
// platform-signed device certificate, valid for 30 days, used inside the QR code.
import { handler, HttpError, json, readJson, optionalUuid } from '../_shared/http.ts';
import { admin, requireUser } from '../_shared/supabase.ts';
import { b64url, signToken, verifyEd25519 } from '../_shared/crypto.ts';
import { pushConfigured, sendPush } from '../_shared/messaging.ts';

interface Body {
  publicKey: string;
  proof: string;
  proofAt: number;
  platform: 'android' | 'ios' | 'web';
  deviceId?: string;
  pushToken?: string | null;
  appVersion?: string;
  locale?: 'en' | 'ar' | 'ckb';
}

const CERT_DAYS = 30;

Deno.serve(handler(async (req) => {
  const { user, sessionId } = await requireUser(req);
  const body = await readJson<Body>(req);

  let validKey = false;
  try { validKey = typeof body.publicKey === 'string' && b64url.decode(body.publicKey).length === 32; } catch { /* invalid encoding */ }
  optionalUuid(body.deviceId, 'device');
  if (!validKey) {
    throw new HttpError(400, 'invalid_public_key');
  }
  if (body.platform !== 'android' && body.platform !== 'ios' && body.platform !== 'web') throw new HttpError(400, 'invalid_platform');

  if (!registrationTimeValid(body.proofAt) || typeof body.proof !== 'string') {
    throw new HttpError(400, 'registration_proof_required');
  }
  const proofMessage = registrationMessage({userId:user.id,sessionId,publicKey:body.publicKey,
    platform:body.platform,deviceId:body.deviceId,pushToken:body.pushToken,proofAt:body.proofAt});
  let proofValid = false;
  try { proofValid = await verifyEd25519(b64url.decode(body.proof), new TextEncoder().encode(proofMessage), b64url.decode(body.publicKey)); } catch { /* fail closed */ }
  if (!proofValid) throw new HttpError(403, 'invalid_registration_proof');
  const expiresAt = new Date(Date.now() + CERT_DAYS * 86_400_000);
  if (body.pushToken != null && (typeof body.pushToken !== 'string' || body.pushToken.length > 4096)) throw new HttpError(400, 'invalid_push_token');
  if (body.appVersion != null && (typeof body.appVersion !== 'string' || body.appVersion.length > 60)) throw new HttpError(400, 'invalid_app_version');
  const { data: registration, error: registrationError } = await admin.rpc('register_session_device', {
    p_session: sessionId, p_user: user.id, p_key: body.publicKey, p_platform: body.platform,
    p_device: optionalUuid(body.deviceId,'device'), p_push: body.pushToken ?? null,
    p_version: body.appVersion ?? null, p_expires: expiresAt.toISOString(),
  });
  if (registrationError) {
    if (registrationError.code === '22023') throw new HttpError(409, registrationError.message);
    throw registrationError;
  }
  const deviceId = registration.deviceId as string;
  const isNew = registration.isNew as boolean;

  if (body.locale && ['en', 'ar', 'ckb'].includes(body.locale)) {
    const { error } = await admin.from('profiles').update({ locale: body.locale }).eq('id', user.id);
    if (error) throw error;
  }

  // A new install signals every other device of this account (account-takeover warning).
  if (isNew && pushConfigured()) {
    const { data: others } = await admin.from('devices').select('id, push_token')
      .eq('user_id', user.id).is('revoked_at', null).neq('id', deviceId).not('push_token', 'is', null).limit(20);
    await Promise.all((others ?? []).map(async (d) => {
      await sendPush(d.push_token!, 'New sign-in', 'Your Brewistan account was just opened on a new phone. If this was not you, contact support.', { kind: 'new_device' }).catch(() => console.error('new_device_notification_failed'));
    }));
  }

  const cert = await signToken({ t: 'dc', u: user.id, d: deviceId, k: body.publicKey, e: Math.floor(expiresAt.getTime() / 1000) });
  return json({ deviceId, cert, certExpiresAt: expiresAt.toISOString(), serverTime: Date.now() });
}));

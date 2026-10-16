// Approval is bound to immutable content/time and consumed atomically in PostgreSQL.
import { handler, HttpError, json, readJson, requireUuid } from '../_shared/http.ts';
import { admin, requireOwner, requireUser } from '../_shared/supabase.ts';
import { randomDigits, sha256Hex } from '../_shared/crypto.ts';
import { sendWhatsAppTemplate, TEMPLATES } from '../_shared/messaging.ts';
import { asciiDigits } from '../_shared/validation.ts';

interface Body { action: 'request' | 'verify'; campaignId: string; code?: string }
function check(result: { data: any; error: any }): any {
  if (result.error) throw result.error;
  if (result.data?.error) {
    const code = String(result.data.error);
    throw new HttpError(code.includes('too_many') || code.includes('limit') || code.includes('cap') || code === 'cooldown' ? 429 : 409, code);
  }
  return result.data;
}
Deno.serve(handler(async (req) => {
  const { user } = await requireUser(req);
  const body = await readJson<Body>(req);
  const id = requireUuid(body.campaignId, 'campaign');
  if (!['request', 'verify'].includes(body.action)) throw new HttpError(400, 'invalid_action');
  const pepper = Deno.env.get('OTP_HASH_PEPPER');
  if (!pepper || pepper.length < 32) throw new HttpError(503, 'otp_not_configured');
  const c = check(await admin.from('push_campaigns').select('*').eq('id', id).maybeSingle());
  if (!c) throw new HttpError(404, 'campaign_not_found');
  await requireOwner(user.id, c.cafe_id);
  if (c.status !== 'draft') throw new HttpError(409, 'not_draft');
  if (Date.parse(c.scheduled_at) < Date.now() + 300_000) throw new HttpError(409, 'schedule_too_soon');
  // Membership count is deliberately not part of this hash. Customers may join or mute
  // between request and verify. The approval covers this explicit audience rule.
  const payload = { id: c.id, cafe: c.cafe_id, title: c.title, body: c.body,
    at: c.scheduled_at, audienceRule: 'active_unmuted_at_dispatch' };
  const hash = await sha256Hex(JSON.stringify(payload));
  if (body.action === 'verify') {
    const code = asciiDigits(body.code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'invalid_code');
    const result = check(await admin.rpc('approve_push_campaign', {
      p_user: user.id, p_campaign: id, p_payload: payload, p_hash: hash,
      p_code_hash: await sha256Hex(`${code}:${hash}:${pepper}`),
    }));
    return json(result);
  }
  if (!check(await admin.rpc('cafe_can_earn', { p_cafe: c.cafe_id }))) throw new HttpError(409, 'subscription_inactive');
  const profile = check(await admin.from('profiles').select('phone,locale').eq('id', user.id).single());
  if (!profile?.phone) throw new HttpError(400, 'no_phone');
  const reservation = check(await admin.rpc('reserve_otp', {
    p_phone_hash: await sha256Hex(profile.phone + pepper), p_purpose: 'step_up',
    p_phone_cap: Number(Deno.env.get('OTP_PER_PHONE_PER_DAY') ?? 5),
    p_global_cap: Number(Deno.env.get('OTP_DAILY_CAP') ?? 2000),
  }));
  const code = randomDigits(6);
  const challenge = check(await admin.rpc('request_push_challenge', {
    p_user: user.id, p_campaign: id, p_hash: hash,
    p_code_hash: await sha256Hex(`${code}:${hash}:${pepper}`),
  }));
  try {
    await sendWhatsAppTemplate(profile.phone, TEMPLATES.otp, [code], { otpButton: true, locale: profile.locale });
  } catch {
    throw new HttpError(502, 'code_delivery_failed');
  }
  check(await admin.from('otp_log').update({ delivered: true }).eq('id', reservation.id));
  const audience = check(await admin.rpc('push_audience_count', { p_cafe: c.cafe_id }));
  return json({ challengeId: challenge.id, expiresAt: challenge.expiresAt, audience });
}));

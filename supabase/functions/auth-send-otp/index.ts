// Supabase Auth "Send SMS" hook: delivers login codes through WhatsApp,
// with rate limits and a daily spend breaker. Configure in
// Dashboard > Authentication > Hooks > Send SMS (HTTPS) pointing at this function.
import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { admin, normalizePhone } from '../_shared/supabase.ts';
import { sha256Hex } from '../_shared/crypto.ts';
import { sendSms, sendWhatsAppTemplate, smsFallbackConfigured, TEMPLATES } from '../_shared/messaging.ts';

interface HookPayload {
  user: { id: string; phone: string; user_metadata?: Record<string, unknown> };
  sms: { otp: string };
}

const PER_PHONE_PER_DAY = Number(Deno.env.get('OTP_PER_PHONE_PER_DAY') ?? 5);
const DAILY_CAP = Number(Deno.env.get('OTP_DAILY_CAP') ?? 2000);

function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const started = Date.now();
  // Supabase's SMS Auth Hook has a short deadline. Reserve time for logging and
  // final HTTP response; bound WhatsApp then SMS fallback under one budget.
  const budgetLeft = () => Math.max(0, 4400 - (Date.now() - started));
  if (req.method !== 'POST') return hookError(405, 'POST required');
  if (Number(req.headers.get('content-length') ?? 0) > 100_000) return hookError(413, 'Payload too large');
  const payload = await req.text();
  if (new TextEncoder().encode(payload).byteLength > 100_000) return hookError(413, 'Payload too large');
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
  let data: HookPayload;
  try {
    data = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return hookError(401, 'Invalid hook signature');
  }

  if (!data?.user?.id || typeof data.user.phone !== 'string' || !/^\d{6,10}$/.test(data.sms?.otp ?? '')) return hookError(400, 'Invalid payload');
  const phone = normalizePhone(data.user.phone);
  if (phone.length < 10 || phone.length > 15) return hookError(400, 'Invalid phone number');
  const pepper = Deno.env.get('OTP_HASH_PEPPER');
  if (!pepper || pepper.length < 32) return hookError(503, 'Sign-in is not configured.');
  const phoneHash = await sha256Hex(phone + pepper);
  const { data: reservation, error: reservationError } = await admin.rpc('reserve_otp', {
    p_phone_hash: phoneHash, p_purpose: 'login', p_phone_cap: PER_PHONE_PER_DAY, p_global_cap: DAILY_CAP,
  });
  if (reservationError || !reservation) return hookError(503, 'Sign-in is temporarily unavailable.');
  if (reservation.error) return hookError(429, 'Too many code requests. Please try again later.');
  const delivered = async () => {
    const { error } = await admin.from('otp_log').update({ delivered: true }).eq('id', reservation.id);
    if (error) console.error('otp delivery log update failed');
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { data: profile } = await admin.from('profiles').select('locale').eq('id', data.user.id).maybeSingle();
  try {
    if (budgetLeft() < 600) throw new Error('hook_deadline');
    await sendWhatsAppTemplate(phone, TEMPLATES.otp, [data.sms.otp], {
      otpButton: true, locale: profile?.locale ?? 'en', timeoutMs: Math.min(2100, budgetLeft() - 400),
    });
  } catch (waError) {
    console.error('WhatsApp OTP failed');
    if (smsFallbackConfigured() && budgetLeft() > 600) {
      try {
        await sendSms(phone, `Your Brewistan code is ${data.sms.otp}. It expires in 5 minutes.`, budgetLeft() - 400);
        return delivered();
      } catch (smsError) {
        console.error('SMS fallback failed');
      }
    }
    return hookError(502, 'We could not deliver your code. Please try again.');
  }

  return delivered();
});

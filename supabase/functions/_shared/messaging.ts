// WhatsApp Cloud API templates, optional Twilio SMS fallback, and FCM push.

const WA_VERSION = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0';

export const TEMPLATES = {
  otp: Deno.env.get('WA_TEMPLATE_OTP') ?? 'brewistan_otp',
  staffInvite: Deno.env.get('WA_TEMPLATE_STAFF_INVITE') ?? 'brewistan_staff_invite',
  staffChange: Deno.env.get('WA_TEMPLATE_STAFF_CHANGE') ?? 'brewistan_staff_change',
  cafeApproved: Deno.env.get('WA_TEMPLATE_CAFE_APPROVED') ?? 'brewistan_cafe_approved',
  cafeRejected: Deno.env.get('WA_TEMPLATE_CAFE_REJECTED') ?? 'brewistan_cafe_rejected',
};

// Template language per app locale. Each template must be approved in Meta for
// every language listed here; missing languages fall back to English.
function templateLanguage(locale: string): string {
  const map: Record<string, string> = JSON.parse(Deno.env.get('WA_TEMPLATE_LANGS') ?? '{"en":"en","ar":"ar"}');
  return map[locale] ?? map.en ?? 'en';
}

export function whatsappConfigured(): boolean {
 return !!(Deno.env.get('WHATSAPP_TOKEN') && Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'));
}

export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  params: string[],
  opts: { locale?: string; otpButton?: boolean } = {},
): Promise<void> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) {
    if (Deno.env.get('WHATSAPP_DEV_LOG') === 'true' && Deno.env.get('APP_ENV') === 'development') {
      // Development only: never enable in production, it writes codes to logs.
      console.log(`[whatsapp:dev] to=${to} template=${template} params=${JSON.stringify(params)}`);
      return;
    }
    throw new Error('whatsapp_not_configured');
  }

  const components: unknown[] = [
    { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
  ];
  if (opts.otpButton) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: params[0] }] });
  }

  const res = await fetch(`https://graph.facebook.com/${WA_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: template, language: { code: templateLanguage(opts.locale ?? 'en') }, components },
    }),
  });
  if (!res.ok) throw new Error(`whatsapp_failed:${res.status}`);
}

export function smsFallbackConfigured(): boolean {
  return !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_FROM'));
}

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
  const auth = btoa(`${sid}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: `+${to}`, From: Deno.env.get('TWILIO_FROM')!, Body: body }),
  });
  if (!res.ok) throw new Error(`sms_failed:${res.status}`);
}

// ---------------------------------------------------------------------------
// Firebase Cloud Messaging (HTTP v1) with a service-account JWT.
// ---------------------------------------------------------------------------

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let fcmToken: { value: string; exp: number } | null = null;
let fcmPending: Promise<string> | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  return JSON.parse(raw) as ServiceAccount;
}

function b64urlString(s: string | Uint8Array): string {
  const bytes = typeof s === 'string' ? new TextEncoder().encode(s) : s;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
 if(fcmToken && fcmToken.exp>Math.floor(Date.now()/1000)+60) return fcmToken.value;
 if(!fcmPending) fcmPending=fetchFcmAccessToken(sa).finally(()=>{fcmPending=null;});
 return fcmPending;
}
async function fetchFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmToken && fcmToken.exp > now + 60) return fcmToken.value;

  const header = b64urlString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlString(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)));
  const assertion = `${header}.${claims}.${b64urlString(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`fcm_token_failed:${res.status}`);
  const data = await res.json();
  fcmToken = { value: data.access_token, exp: now + Number(data.expires_in ?? 3600) };
  return fcmToken.value;
}

export function pushConfigured(): boolean {
  return serviceAccount() !== null;
}

/** Returns "sent", "invalid_token" or "failed". */
export async function sendPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<'sent' | 'invalid_token' | 'failed'> {
  const sa = serviceAccount();
  if (!sa) return 'failed';
  const access = await fcmAccessToken(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title, body }, data,
      ...(data.deliveryId ? {
        android: { ttl: '3600s', notification: { tag: data.deliveryId } },
        apns: { headers: { 'apns-collapse-id': data.deliveryId, 'apns-expiration': String(Math.floor(Date.now()/1000)+3600) } },
      } : {}),
    } }),
  });
  if (res.ok) return 'sent';
  const response = await res.json().catch(() => ({}));
  if (response?.error?.details?.some((d: { errorCode?: string }) => d.errorCode === 'UNREGISTERED')) return 'invalid_token';
  // INVALID_ARGUMENT may mean a malformed message, not a bad registration token.
  console.error('fcm send failed', res.status);
  return 'failed';
}

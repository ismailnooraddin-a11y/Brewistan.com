export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}

/** Reflect only configured browser origins; native and signed webhook requests have no Origin. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const configured = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('ALLOWED_ORIGIN') ??
    'https://dashboard.brewistan.com,https://admin.brewistan.com';
  const allowed = configured.split(',').map((v) => v.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) throw new HttpError(403, 'origin_not_allowed');
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    let headers: Record<string, string> = { 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    let response: Response;
    try {
      headers = corsHeaders(req);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      response = await fn(req);
    } catch (e) {
      if (e instanceof HttpError) response = json({ error: e.code, message: e.message }, e.status);
      else {
        // Log an identifier, not a provider response containing credentials or personal data.
        console.error('request_failed', e instanceof Error ? e.name : 'database_error');
        response = json({ error: 'internal_error' }, 500);
      }
    }
    for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    if (response.status === 405) response.headers.set('Allow', 'POST, OPTIONS');
    return response;
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) throw new HttpError(415, 'json_required');
  const maxBytes = 2_000_000;
  if (Number(req.headers.get('content-length') ?? 0) > maxBytes) throw new HttpError(413, 'body_too_large');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid_json');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new HttpError(413, 'body_too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object_required');
    return value as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'invalid_json');
  } finally { reader.releaseLock(); }
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(400, 'invalid_' + field);
  return value.toLowerCase();
}
export function optionalUuid(value: unknown, field: string): string | null {
  return value === null || value === undefined || value === '' ? null : requireUuid(value, field);
}

'use client';

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      // Session cookies only: no "remember me" on shared back-office computers.
      { cookieOptions: { maxAge: undefined, sameSite: 'lax', secure: true } },
    );
  }
  return client;
}

/** Calls an Edge Function and throws an Error with the server's message on failure. */
export async function callFunction<T = Record<string, unknown>>(name: string, body: unknown): Promise<T> {
  const { data, error } = await createClient().functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = await ctx.json();
        message = payload.message ?? payload.error ?? message;
      }
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return data as T;
}

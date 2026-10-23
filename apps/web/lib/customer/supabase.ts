'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Customers stay signed in across visits: the session lives in this browser's
// local storage and refreshes itself. It is separate from the café-owner login.
let client: SupabaseClient | null = null;

export function customerClient(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'bw-customer-auth' },
    });
  }
  return client;
}

export class CustomerApiError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code); }
}

/** Calls an Edge Function and turns its error body into a readable code. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await customerClient().functions.invoke(name, { body });
  if (error) {
    let code = 'unavailable';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json();
        code = payload.code ?? payload.error ?? code;
      } catch { /* keep generic code */ }
    }
    throw new CustomerApiError(code);
  }
  return data as T;
}

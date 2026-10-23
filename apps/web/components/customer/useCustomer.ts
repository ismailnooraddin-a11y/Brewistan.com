'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { customerClient } from '@/lib/customer/supabase';

export interface CustomerState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  /** null means unavailable/unknown, NOT incomplete registration. */
  profileComplete: boolean | null;
  firstName: string | null;
}
const CACHE = 'bw.profile.v1';
function cached(userId: string): { complete: boolean; firstName: string | null } | null {
  try {
    const record = JSON.parse(localStorage.getItem(CACHE) || 'null');
    return record?.userId === userId ? { complete: record.complete === true, firstName: record.firstName ?? null } : null;
  } catch { return null; }
}

export function useCustomer() {
  const [state, setState] = useState<CustomerState>({ status: 'loading', user: null, profileComplete: null, firstName: null });

  const refresh = useCallback(async () => {
    const client = customerClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      setState({ status: 'signedOut', user: null, profileComplete: false, firstName: null });
      return;
    }
    const previous = cached(session.user.id);
    const { data, error } = await client.from('profiles').select('first_name,last_name,gender').eq('id', session.user.id).maybeSingle();
    if (error || !data) {
      setState({ status: 'signedIn', user: session.user, profileComplete: previous?.complete ?? null, firstName: previous?.firstName ?? null });
      return;
    }
    const complete = !!(data.first_name && data.last_name && data.gender);
    try { localStorage.setItem(CACHE, JSON.stringify({ userId: session.user.id, complete, firstName: data.first_name ?? null })); } catch { /* ignore */ }
    setState({ status: 'signedIn', user: session.user, profileComplete: complete, firstName: data.first_name ?? null });
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = customerClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...state, refresh };
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { customerClient } from '@/lib/customer/supabase';

export interface CustomerState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  profileComplete: boolean;
  firstName: string | null;
}

/** The signed-in customer (kept across visits) and whether registration is complete. */
export function useCustomer() {
  const [state, setState] = useState<CustomerState>({ status: 'loading', user: null, profileComplete: false, firstName: null });

  const refresh = useCallback(async () => {
    const client = customerClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session) { setState({ status: 'signedOut', user: null, profileComplete: false, firstName: null }); return; }
    const { data } = await client.from('profiles').select('first_name,last_name,gender').eq('id', session.user.id).maybeSingle();
    setState({
      status: 'signedIn',
      user: session.user,
      profileComplete: !!(data?.first_name && data?.last_name && data?.gender),
      firstName: data?.first_name ?? null,
    });
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = customerClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...state, refresh };
}

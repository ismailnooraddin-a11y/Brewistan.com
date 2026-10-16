'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function VoidButton({ redemptionId }: { redemptionId: string }) {
  const router = useRouter();
  async function onClick() {
    const reason = prompt('Why are you voiding this redemption? The reward returns to the customer.');
    if (!reason?.trim()) return;
    const { error } = await createClient().rpc('void_redemption', { p_redemption: redemptionId, p_reason: reason.trim() });
    if (error) alert(error.message);
    else router.refresh();
  }
  return <button className="btn-ghost px-3 py-1.5" onClick={onClick}>Void</button>;
}

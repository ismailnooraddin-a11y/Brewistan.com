'use client';
import { callFunction } from './supabase';

export interface WalletReward { id: string; expiresAt: string; rewardLabel: Record<string, string> | null; voucher?: string }
export interface WalletCard {
  cafeId: string; name: string; tier: string; brand: Record<string, string> | null; logoUrl: string | null;
  archived: boolean; stampsInCurrent: number; stampsRequired: number; rewardLabel: Record<string, string> | null;
  rewards: WalletReward[];
}
export interface Wallet { profile: { tier?: string; first_name?: string } | null; cards: WalletCard[] }

const CACHE = 'bw.wallet.v1';

/** Last wallet saved on this phone; it is a display cache, never proof of a stamp or reward. */
export function cachedWallet(userId: string): Wallet | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE) ?? 'null');
    return saved?.userId === userId ? (saved.wallet as Wallet) : null;
  } catch { return null; }
}

type WalletPage = { profile: Wallet['profile']; cards: WalletCard[]; nextCursor?: string | null };

/** All pages, not just the first 50. The server retains authority for each reward. */
export async function fetchWallet(userId: string): Promise<Wallet> {
  const cards: WalletCard[] = [];
  const visited = new Set<string>();
  let cursor: string | null = null;
  let profile: Wallet['profile'] = null;
  do {
    const page: WalletPage = await callFunction<WalletPage>('wallet', { cursor });
    if (profile === null) profile = page.profile;
    cards.push(...page.cards.map((c) => ({ ...c, rewards: c.rewards ?? [] })));
    cursor = page.nextCursor ?? null;
    if (cursor && visited.has(cursor)) throw new Error('wallet_pagination_loop');
    if (cursor) visited.add(cursor);
    if (visited.size > 100) throw new Error('wallet_too_many_pages');
  } while (cursor);
  const wallet = { profile, cards };
  try { localStorage.setItem(CACHE, JSON.stringify({ userId, wallet })); } catch { /* display still works */ }
  return wallet;
}

export function clearWalletCache() {
  try { localStorage.removeItem(CACHE); } catch { /* ignore */ }
}

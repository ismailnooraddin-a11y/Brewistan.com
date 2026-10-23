'use client';
import { callFunction } from './supabase';

export interface WalletReward { id: string; expiresAt: string; rewardLabel: Record<string, string> | null }
export interface WalletCard {
  cafeId: string; name: string; tier: string; brand: Record<string, string> | null; logoUrl: string | null;
  archived: boolean; stampsInCurrent: number; stampsRequired: number; rewardLabel: Record<string, string> | null;
  rewards: WalletReward[];
}
export interface Wallet { profile: { tier?: string; first_name?: string } | null; cards: WalletCard[] }

const CACHE = 'bw.wallet.v1';

/** Last wallet saved on this phone (for instant display); the server stays the source of truth. */
export function cachedWallet(userId: string): Wallet | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE) ?? 'null');
    return saved?.userId === userId ? (saved.wallet as Wallet) : null;
  } catch {
    return null;
  }
}

export async function fetchWallet(userId: string): Promise<Wallet> {
  const res = await callFunction<{ profile: Wallet['profile']; cards: WalletCard[] }>('wallet', {});
  const wallet: Wallet = {
    profile: res.profile,
    cards: res.cards.map((c) => ({ ...c, rewards: (c.rewards ?? []).map(({ id, expiresAt, rewardLabel }) => ({ id, expiresAt, rewardLabel })) })),
  };
  try { localStorage.setItem(CACHE, JSON.stringify({ userId, wallet })); } catch { /* ignore */ }
  return wallet;
}

export function clearWalletCache() {
  try { localStorage.removeItem(CACHE); } catch { /* ignore */ }
}

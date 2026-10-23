import { cardDesignById } from '@/lib/card-designs';

// Same rules as the mobile app (apps/mobile/lib/cards/card_designs.dart):
// Classic cafés use the customer's status colours; Signature and Bespoke use the café's own.
const TIER_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  bronze: { bg: '#6E4423', fg: '#F3E9DD', label: 'Bronze' },
  silver: { bg: '#5E6469', fg: '#F2F4F6', label: 'Silver' },
  gold: { bg: '#7A5A1F', fg: '#FFF4D6', label: 'Gold' },
  matte_black: { bg: '#151311', fg: '#E8DCC6', label: 'Matte black' },
};

export interface CardLook { bg: string; fg: string; tag: string }

export function cardLook(tier: string, brand: Record<string, string> | null | undefined, customerTier = 'bronze'): CardLook {
  if (tier === 'signature' || tier === 'bespoke') {
    const design = cardDesignById(brand?.template);
    const hex = /^#[0-9a-fA-F]{6}$/;
    return {
      bg: brand?.primary && hex.test(brand.primary) ? brand.primary : design.bg,
      fg: brand?.accent && hex.test(brand.accent) ? brand.accent : design.fg,
      tag: 'Loyalty',
    };
  }
  const t = TIER_COLORS[customerTier] ?? TIER_COLORS.bronze;
  return { bg: t.bg, fg: t.fg, tag: t.label };
}

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
}

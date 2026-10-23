/** Scoped premium scene experiment. Never alters loyalty data or other cafes. */
export const NANA_TEA_CAFE_ID = '5b89b7ab-46a8-4328-99b1-bebc752b921d';

export function isNanaSceneCafe(cafeId: string): boolean {
  return cafeId.toLowerCase() === NANA_TEA_CAFE_ID;
}

/** Bespoke automatically qualifies. Signature is only an opt-in visual test. */
export function shouldShowNanaScene(cafeId: string, tier: string, testOptIn: boolean): boolean {
  return isNanaSceneCafe(cafeId) && (tier === 'bespoke' || (tier === 'signature' && testOptIn));
}

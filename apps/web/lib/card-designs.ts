// =============================================================================
// ALL STAMP-CARD LOOKS FOR THE DASHBOARD LIVE IN THIS FILE.
//
// To ADD a design:    add a line to CARD_DESIGNS with a new lowercase id
//                     (letters, digits, underscore, 2-24 characters), a name,
//                     a background colour and a text colour (6-digit hex).
//                     Then add the same id to apps/mobile/lib/cards/card_designs.dart.
//                     No database change is needed.
// To REMOVE a design: delete its line here and in the mobile file. Cafes that
//                     had chosen it automatically fall back to the default.
// =============================================================================

export interface CardDesign {
  id: string;
  name: string;
  /** Card background colour. */
  bg: string;
  /** Cafe name and stamp colour. */
  fg: string;
}

/** Used when a cafe has not chosen a design, or chose one that was removed. */
export const DEFAULT_CARD_DESIGN_ID = 'noir';

/** Keep the same ids and colours as the mobile app. */
export const CARD_DESIGNS: CardDesign[] = [
  { id: 'noir', name: 'Noir', bg: '#151311', fg: '#e8dcc6' },
  { id: 'espresso', name: 'Espresso', bg: '#3b2a20', fg: '#f3e6d3' },
  { id: 'marble', name: 'Marble', bg: '#f1eee8', fg: '#2a2622' },
  { id: 'emerald', name: 'Emerald', bg: '#123c33', fg: '#e5d3a1' },
];

export const CARD_DESIGN_ID_PATTERN = /^[a-z][a-z0-9_]{1,23}$/;

/** Finds a design by id; unknown or missing ids give the default design. */
export function cardDesignById(id: string | null | undefined): CardDesign {
  return (
    CARD_DESIGNS.find((d) => d.id === id) ??
    CARD_DESIGNS.find((d) => d.id === DEFAULT_CARD_DESIGN_ID) ??
    CARD_DESIGNS[0]
  );
}

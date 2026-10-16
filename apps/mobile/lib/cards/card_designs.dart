import 'package:flutter/material.dart';

import '../state/models.dart';
import '../theme.dart';

// =============================================================================
// ALL STAMP-CARD LOOKS LIVE IN THIS FILE.
//
// To ADD a design:    copy one block in [cardDesigns], give it a new lowercase
//                     id (letters, digits, underscore, 2-24 characters), a name,
//                     two background colours and a text colour.
//                     Then add the same id to apps/web/lib/card-designs.ts.
//                     No database change is needed.
// To REMOVE a design: delete its block here and in card-designs.ts. Cafes that
//                     had chosen it automatically fall back to the default.
// To CHANGE the look of the customer-status ribbon / Classic cards:
//                     edit [tierGradients] below.
// =============================================================================

/// One selectable card look (used by Signature cafes).
class CardDesign {
  const CardDesign({
    required this.id,
    required this.name,
    required this.background,
    required this.foreground,
  });

  final String id;
  final String name;

  /// Gradient from first to last colour, top-left to bottom-right.
  final List<Color> background;

  /// Colour of the cafe name and the stamp pieces.
  final Color foreground;
}

/// The id used when a cafe has not chosen a design, or chose one that was removed.
const String defaultCardDesignId = 'noir';

/// Designs a Signature cafe can choose from. Keep the same ids as the web file.
const List<CardDesign> cardDesigns = [
  CardDesign(
    id: 'noir',
    name: 'Noir',
    background: [Color(0xFF151311), Color(0xFF0F0E0D)],
    foreground: Color(0xFFE8DCC6),
  ),
  CardDesign(
    id: 'espresso',
    name: 'Espresso',
    background: [Color(0xFF3B2A20), Color(0xFF2C1F18)],
    foreground: Color(0xFFF3E6D3),
  ),
  CardDesign(
    id: 'marble',
    name: 'Marble',
    background: [Color(0xFFF1EEE8), Color(0xFFB5B2AD)],
    foreground: Color(0xFF2A2622),
  ),
  CardDesign(
    id: 'emerald',
    name: 'Emerald',
    background: [Color(0xFF123C33), Color(0xFF0D2D26)],
    foreground: Color(0xFFE5D3A1),
  ),
];

/// Card backgrounds for the customer's status tier (also used for Classic cafes).
const Map<String, List<Color>> tierGradients = {
  'bronze': [Color(0xFF6B4A2F), Color(0xFFA9774B)],
  'silver': [Color(0xFF5E6266), Color(0xFFB9BEC3)],
  'gold': [Color(0xFF8A6B3D), Color(0xFFD9B87A)],
  'matte_black': [Color(0xFF0B0B0B), Color(0xFF26231F)],
};

/// Finds a design by id; unknown or missing ids give the default design.
CardDesign cardDesignById(String? id) {
  for (final design in cardDesigns) {
    if (design.id == id) return design;
  }
  for (final design in cardDesigns) {
    if (design.id == defaultCardDesignId) return design;
  }
  return cardDesigns.first;
}

/// Final colours for drawing one card.
class CardLook {
  const CardLook(this.background, this.foreground);
  final List<Color> background;
  final Color foreground;
}

/// Decides how a cafe's card looks:
///  - Classic:   the customer's status colours.
///  - Signature: the design the cafe picked.
///  - Bespoke:   the cafe's own two colours.
CardLook resolveCardLook(CafeCard card, String customerTier) {
  if (card.tier == 'bespoke') {
    final bg = parseHex(card.brand['primary'] as String?) ?? BrewColors.ink;
    final fg = parseHex(card.brand['accent'] as String?) ?? BrewColors.gold;
    return CardLook([bg, Color.lerp(bg, Colors.black, 0.35)!], fg);
  }
  if (card.tier == 'signature') {
    final design = cardDesignById(card.brand['template'] as String?);
    return CardLook(design.background, design.foreground);
  }
  final gradient = tierGradients[customerTier] ?? tierGradients['bronze']!;
  return CardLook(gradient, BrewColors.cream);
}

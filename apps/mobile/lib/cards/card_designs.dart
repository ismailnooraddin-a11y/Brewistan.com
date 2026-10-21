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
/// Three tones per tier (dark, bright highlight, dark) give a brushed-metal band
/// rather than a flat two-colour blend. Bronze (the starting tier) stays modest;
/// the top tier (matte_black) is the most dramatic.
const Map<String, List<Color>> tierGradients = {
  'bronze': [Color(0xFF6E4423), Color(0xFFB87B4B), Color(0xFF5B3A1E)],
  'silver': [Color(0xFF6E747A), Color(0xFFE6EAEE), Color(0xFF585D62)],
  'gold': [Color(0xFF7A5A1F), Color(0xFFEFCD7E), Color(0xFF7A5A1F)],
  'matte_black': [Color(0xFF050505), Color(0xFF2E2B26), Color(0xFF000000)],
};

/// Drop shadow for a tier's card. Grows softer-to-stronger with tier rank, so the
/// top tier visibly sits "heavier" on the screen than the starting one.
class TierShadow {
  const TierShadow({required this.color, required this.blur, required this.spread, required this.dy});
  final Color color;
  final double blur;
  final double spread;
  final double dy;

  List<BoxShadow> get shadows => [BoxShadow(color: color, blurRadius: blur, spreadRadius: spread, offset: Offset(0, dy))];
}

const Map<String, TierShadow> tierShadows = {
  'bronze': TierShadow(color: Color(0x33000000), blur: 14, spread: 0, dy: 6),
  'silver': TierShadow(color: Color(0x3D000000), blur: 18, spread: 0, dy: 8),
  'gold': TierShadow(color: Color(0x4D000000), blur: 24, spread: 1, dy: 10),
  'matte_black': TierShadow(color: Color(0x66000000), blur: 32, spread: 2, dy: 14),
};

TierShadow tierShadowFor(String tier) => tierShadows[tier] ?? tierShadows['bronze']!;

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
  const CardLook(this.background, this.foreground, {this.branded = false});
  final List<Color> background;
  final Color foreground;

  /// True for Signature and Bespoke cafes: drawn with the cafe's own solid
  /// colour, a fine hairline edge and pressed-in stamp slots. Classic cards
  /// (false) use the customer's metallic status colours instead.
  final bool branded;
}

/// Decides how a cafe's card looks:
///  - Classic:             the customer's status colours (metallic).
///  - Signature / Bespoke: the cafe's own two colours, falling back to the
///                         preset they picked if they never chose colours.
CardLook resolveCardLook(CafeCard card, String customerTier) {
  if (card.tier == 'signature' || card.tier == 'bespoke') {
    final design = cardDesignById(card.brand['template'] as String?);
    final bg = parseHex(card.brand['primary'] as String?) ?? design.background.first;
    final fg = parseHex(card.brand['accent'] as String?) ?? design.foreground;
    return CardLook([bg, bg], fg, branded: true);
  }
  final gradient = tierGradients[customerTier] ?? tierGradients['bronze']!;
  return CardLook(gradient, BrewColors.cream);
}

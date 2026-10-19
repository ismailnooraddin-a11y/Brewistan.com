import 'package:flutter/material.dart';

import '../cards/card_designs.dart';
import '../state/models.dart';
import 'puzzle.dart';

/// A cafe card. Classic cafes use the customer's status tier background; Signature
/// cafes use their template; Bespoke cafes use their own colours. The tier ribbon is always shown.
class LoyaltyCard extends StatelessWidget {
  const LoyaltyCard({
    super.key,
    required this.card,
    required this.customerTier,
    required this.tierLabel,
    required this.rewardText,
    this.archivedText,
    this.onTap,
    this.now,
  });

  final DateTime? now;
  final CafeCard card;
  final String customerTier;
  final String tierLabel;
  final String rewardText;
  final String? archivedText;
  final VoidCallback? onTap;

  // Choose a foreground that remains readable at both gradient endpoints.
  Color _readable(List<Color> backgrounds, Color preferred) {
    double worst(Color foreground) => backgrounds.map((background) {
      final a = foreground.computeLuminance(), b = background.computeLuminance();
      return (a > b ? a + 0.05 : b + 0.05) / (a > b ? b + 0.05 : a + 0.05);
    }).reduce((a, b) => a < b ? a : b);
    if (worst(preferred) >= 4.5) return preferred;
    return worst(Colors.white) >= worst(Colors.black) ? Colors.white : Colors.black;
  }

  @override
  Widget build(BuildContext context) {
    final look = resolveCardLook(card, customerTier);
    final bg = look.background;
    final preferred = look.foreground;
    final fg = _readable(bg, preferred);
    final tierBg = tierGradients[customerTier] ?? tierGradients['bronze']!;
    final tierFg = _readable(tierBg, Colors.white);
    final hasReward = card.rewards.any((r)=>r.expiresAt.isAfter(now??DateTime.now()));
    return Opacity(
      opacity: card.archived ? 0.55 : 1,
      child: Material(
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: bg, begin: Alignment.topLeft, end: Alignment.bottomRight),
            ),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  if (card.logoUrl != null) ...[
                    CircleAvatar(radius: 18, backgroundColor: Colors.white10, backgroundImage: NetworkImage(card.logoUrl!)),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(card.name,
                        style: TextStyle(color: fg, fontSize: 20, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: tierBg),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Text(tierLabel, style: TextStyle(color: tierFg, fontSize: 11, letterSpacing: 0.6)),
                  ),
                ]),
                const SizedBox(height: 18),
                PuzzleGrid(
                  filled: card.stampsInCurrent,
                  total: card.stampsRequired,
                  color: fg,
                  name: card.name,
                  style: (card.brand['stamp'] as String?) ?? defaultStampStyle,
                ),
                const SizedBox(height: 14),
                if (archivedText != null && card.archived)
                  Text(archivedText!, style: TextStyle(color: fg.withValues(alpha: 0.8)))
                else if (hasReward)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: fg, borderRadius: BorderRadius.circular(10)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.local_cafe, size: 18, color: bg.first),
                      const SizedBox(width: 8),
                      Flexible(child: Text(rewardText, style: TextStyle(color: bg.first, fontWeight: FontWeight.w600))),
                    ]),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

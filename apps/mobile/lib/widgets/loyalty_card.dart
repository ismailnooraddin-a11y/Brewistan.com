import 'package:flutter/material.dart';

import '../cards/card_designs.dart';
import '../state/models.dart';
import 'puzzle.dart';

/// A cafe card.
///  - Classic cafes: the customer's metallic status colours.
///  - Signature and Bespoke cafes: the cafe's own colour, a fine hairline edge,
///    the logo in a thin ring, pressed-in stamp slots and a progress line.
class LoyaltyCard extends StatelessWidget {
  const LoyaltyCard({
    super.key,
    required this.card,
    required this.customerTier,
    required this.tierLabel,
    required this.rewardText,
    this.goalText,
    this.archivedText,
    this.onTap,
    this.now,
    this.compact = false,
  });

  final DateTime? now;
  final bool compact;
  final CafeCard card;
  final String customerTier;
  final String tierLabel;
  final String rewardText;

  /// What the customer is collecting towards, for example "Free Coffee".
  final String? goalText;
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

  bool get _hasReward => card.rewards.any((r) => r.expiresAt.isAfter(now ?? DateTime.now()));

  @override
  Widget build(BuildContext context) {
    final look = resolveCardLook(card, customerTier);
    final fg = _readable(look.background, look.foreground);
    return Opacity(
      opacity: card.archived ? 0.55 : 1,
      child: compact ? _compact(look.background, fg, look.branded)
        : look.branded ? _branded(look.background.first, fg) : _classic(look.background, fg),
    );
  }

  // Dense wallet item, intentionally identical quality for all packages. The
  // expanded card and QR remain on the next screen: five cafes fit gracefully.
  Widget _compact(List<Color> backgrounds, Color fg, bool branded) {
    final bg = backgrounds.first;
    final total = card.stampsRequired.clamp(1, 20).toInt();
    final filled = card.stampsInCurrent.clamp(0, total).toInt();
    final light = bg.computeLuminance() > 0.5;
    return Material(
      borderRadius: BorderRadius.circular(19),
      clipBehavior: Clip.antiAlias,
      color: bg,
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(19),
          gradient: LinearGradient(colors: backgrounds, begin: Alignment.topLeft, end: Alignment.bottomRight),
          border: Border.all(color: fg.withValues(alpha: light ? 0.25 : 0.34)),
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(17, 16, 17, 14),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                Container(
                  height: 38, width: 38,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(11),
                    color: fg.withValues(alpha: 0.07),
                    border: Border.all(color: fg.withValues(alpha: 0.25)),
                  ),
                  child: Center(child: card.logoUrl != null && branded
                    ? ClipRRect(borderRadius: BorderRadius.circular(9), child: Image.network(card.logoUrl!, fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Text(card.name.isNotEmpty ? card.name[0] : 'B', style: TextStyle(color: fg, fontSize: 19))))
                    : Text(card.name.isNotEmpty ? card.name[0].toUpperCase() : 'B', style: TextStyle(color: fg, fontSize: 19))),
                ),
                const SizedBox(width: 11),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(card.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: fg, fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: -0.4)),
                  Text(tierLabel.toUpperCase(), maxLines: 1,
                    style: TextStyle(color: fg.withValues(alpha: .65), fontSize: 9.5, letterSpacing: 1.4)),
                ])),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('STAMPS', style: TextStyle(fontSize: 9, letterSpacing: 1.5, color: fg.withValues(alpha: .65))),
                  Text('$filled / $total', style: TextStyle(color: fg, fontSize: 19, fontWeight: FontWeight.w600)),
                ]),
              ]),
              const SizedBox(height: 14),
              Row(children: List.generate(total, (i) => Expanded(child: Container(
                height: 5, margin: const EdgeInsetsDirectional.only(end: 3),
                decoration: BoxDecoration(color: fg.withValues(alpha: i < filled ? .95 : .17),
                  borderRadius: BorderRadius.circular(5)),
              )))),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: Text(goalText ?? '', maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: fg.withValues(alpha: .83), fontSize: 11.5))),
                const SizedBox(width: 8),
                if (_hasReward) Text(rewardText, maxLines: 1,
                  style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 11)),
                if (card.archived && archivedText != null) Text(archivedText!, style: TextStyle(color: fg, fontSize: 11)),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Signature and Bespoke
  // ---------------------------------------------------------------------------
  Widget _branded(Color bg, Color fg) {
    final light = bg.computeLuminance() > 0.5;
    const radius = 20.0;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: light ? 0.18 : 0.32), blurRadius: 30, offset: const Offset(0, 16), spreadRadius: -10),
          BoxShadow(color: Colors.black.withValues(alpha: light ? 0.06 : 0.12), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Stack(children: [
            // Same-colour depth only: a whisper of light from the top and a soft
            // shade at the bottom right. The accent colour is never blended in.
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: const Alignment(-0.4, -1.2),
                      radius: 1.3,
                      colors: [Colors.white.withValues(alpha: light ? 0.45 : 0.07), Colors.white.withValues(alpha: 0)],
                    ),
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: const Alignment(1.0, 1.2),
                      radius: 1.1,
                      colors: [Colors.black.withValues(alpha: light ? 0.06 : 0.22), Colors.black.withValues(alpha: 0)],
                    ),
                  ),
                ),
              ),
            ),
            // Metallic hairline edge.
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(radius),
                    border: Border.all(color: fg.withValues(alpha: 0.35), width: 1),
                  ),
                ),
              ),
            ),
            // Fainter inner frame.
            Positioned.fill(
              child: IgnorePointer(
                child: Padding(
                  padding: const EdgeInsets.all(9),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(radius - 7),
                      border: Border.all(color: fg.withValues(alpha: 0.13), width: 1),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    _medallion(fg),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(card.name,
                          style: TextStyle(color: fg, fontSize: 19, fontWeight: FontWeight.w500, height: 1.15),
                          overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(width: 8),
                    Text(tierLabel.toUpperCase(),
                        style: TextStyle(color: fg.withValues(alpha: 0.6), fontSize: 9.5, letterSpacing: 1.6)),
                  ]),
                  const SizedBox(height: 18),
                  PuzzleGrid(filled: card.stampsInCurrent, total: card.stampsRequired, color: fg, onLightCard: light),
                  const SizedBox(height: 14),
                  if (archivedText != null && card.archived)
                    Text(archivedText!, style: TextStyle(color: fg.withValues(alpha: 0.8)))
                  else
                    Container(
                      padding: const EdgeInsets.only(top: 10),
                      decoration: BoxDecoration(border: Border(top: BorderSide(color: fg.withValues(alpha: 0.14)))),
                      child: Row(children: [
                        Text('${card.stampsInCurrent} / ${card.stampsRequired}',
                            style: TextStyle(
                                color: fg, fontSize: 13, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _hasReward ? rewardText : (goalText ?? ''),
                            textAlign: TextAlign.end,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: fg.withValues(alpha: _hasReward ? 1 : 0.75),
                              fontSize: 12,
                              fontWeight: _hasReward ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ),
                      ]),
                    ),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }

  /// The cafe's logo inside a thin ring, or its first letter when there is no logo.
  Widget _medallion(Color fg) {
    final trimmed = card.name.trim();
    final initial = trimmed.isEmpty ? '?' : String.fromCharCode(trimmed.runes.first).toUpperCase();
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: fg.withValues(alpha: 0.5), width: 1)),
      padding: const EdgeInsets.all(3),
      child: ClipOval(
        child: card.logoUrl != null
            ? Image.network(card.logoUrl!, fit: BoxFit.contain,
                errorBuilder: (context, error, stack) => Center(child: Text(initial, style: TextStyle(color: fg, fontSize: 15))))
            : Center(child: Text(initial, style: TextStyle(color: fg, fontSize: 15))),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Classic: the customer's metallic status colours
  // ---------------------------------------------------------------------------
  Widget _classic(List<Color> bg, Color fg) {
    final tierBg = tierGradients[customerTier] ?? tierGradients['bronze']!;
    final tierFg = _readable(tierBg, Colors.white);
    // The drop shadow grows with the customer's own status tier, so a VIP
    // customer's card visibly sits "heavier" on screen at every cafe.
    final shadow = tierShadowFor(customerTier);
    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), boxShadow: shadow.shadows),
      child: Material(
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: bg, begin: Alignment.topLeft, end: Alignment.bottomRight),
              border: Border.all(color: Colors.white.withValues(alpha: 0.10), width: 1),
            ),
            child: Stack(children: [
              // Soft diagonal sheen so the status colours read as metal.
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Colors.white.withValues(alpha: 0.16), Colors.white.withValues(alpha: 0.0)],
                        stops: const [0.0, 0.55],
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
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
                    PuzzleGrid(filled: card.stampsInCurrent, total: card.stampsRequired, color: fg),
                    const SizedBox(height: 14),
                    if (archivedText != null && card.archived)
                      Text(archivedText!, style: TextStyle(color: fg.withValues(alpha: 0.8)))
                    else if (_hasReward)
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
            ]),
          ),
        ),
      ),
    );
  }
}

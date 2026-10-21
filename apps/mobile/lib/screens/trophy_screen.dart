import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../state/models.dart';
import '../cards/card_designs.dart';
import '../theme.dart';

class TrophyScreen extends StatelessWidget {
  const TrophyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final wallet = state.wallet;
    final tier = wallet?.tier ?? 'bronze';
    final next = nextTier(tier);
    final completed = wallet?.completedTotal ?? 0;
    final from = tierThresholds[tier]!;
    final to = next == null ? from : tierThresholds[next]!;
    final progress = next == null ? 1.0 : ((completed - from) / (to - from)).clamp(0.0, 1.0);
    final badges = (wallet?.cards ?? []).where((c) => c.completedPuzzles > 0).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      children: [
        Text(state.t('trophy.title'), style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: tierGradients[tier]!, begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(20),
            boxShadow: tierShadowFor(tier).shadows,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(state.t('trophy.tier'), style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 4),
            Text(state.t('tier.$tier'), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600, color: Colors.white)),
            if (next != null) ...[
              const SizedBox(height: 16),
              LinearProgressIndicator(
                value: progress,
                color: Colors.white,
                backgroundColor: Colors.white24,
                minHeight: 4,
                borderRadius: BorderRadius.circular(2),
              ),
              const SizedBox(height: 8),
              Text('${state.t('trophy.next')} ${state.t('tier.$next')}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ]),
        ),
        const SizedBox(height: 24),
        if (badges.isEmpty)
          Text(state.t('trophy.empty'), style: const TextStyle(color: BrewColors.muted))
        else
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            children: [
              for (final card in badges)
                for (var i = 0; i < card.completedPuzzles.clamp(0, 30); i++)
                  _Badge(name: card.name, highlight: i == card.completedPuzzles - 1),
            ],
          ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.name, required this.highlight});
  final String name;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: BrewColors.inkSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: highlight ? BrewColors.gold : Colors.white10),
      ),
      padding: const EdgeInsets.all(8),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.extension, color: BrewColors.gold, size: 30),
        const SizedBox(height: 6),
        Text(name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11)),
      ]),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../state/models.dart';
import '../theme.dart';
import '../widgets/rotating_qr.dart';

/// The customer's code. Opened from a cafe card, it also carries that cafe's
/// signed reward voucher so a barista can redeem it offline.
class CodeScreen extends StatelessWidget {
  const CodeScreen({super.key, this.card});
  final CafeCard? card;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final currentCards = state.wallet?.cards.where((c) => c.cafeId == card?.cafeId).toList() ?? <CafeCard>[];
    final liveCard = currentCards.isNotEmpty ? currentCards.first : null;
    final rewards = liveCard?.rewards.where((r) => r.expiresAt.isAfter(state.time.now())).toList() ?? <RewardInfo>[];
    final voucher = liveCard?.archived == false && rewards.isNotEmpty ? rewards.first.voucher : null;
    final body = Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(state.t('code.title'), style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
          if (card != null) ...[
            const SizedBox(height: 6),
            Text(card!.name, style: const TextStyle(color: BrewColors.gold)),
          ],
          const SizedBox(height: 24),
          RotatingQr(key: ValueKey(voucher ?? 'plain'), voucher: voucher, voucherExpiresAt: rewards.isNotEmpty?rewards.first.expiresAt:null),
          if (voucher != null) ...[
            const SizedBox(height: 16),
            Text('${state.t('code.withReward')} ${card!.name}', style: const TextStyle(color: BrewColors.muted)),
          ],
        ]),
      ),
    );
    if (card == null) return body;
    return Scaffold(appBar: AppBar(), body: body);
  }
}

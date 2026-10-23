import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/loyalty_card.dart';
import 'code_screen.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final wallet = state.wallet;
    final tier = wallet?.tier ?? 'bronze';
    return RefreshIndicator(
      color: BrewColors.gold,
      onRefresh: state.refreshAll,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        children: [
          Text(
            wallet?.firstName != null ? '${state.t('wallet.hello')} ${wallet!.firstName}' : 'Brewistan',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (state.walletFromCache)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(state.t('wallet.offline'), style: const TextStyle(color: BrewColors.muted, fontSize: 12)),
            ),
          if (state.walletError != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(state.walletError!, style: const TextStyle(color: BrewColors.bad))),
          const SizedBox(height: 20),
          if (wallet == null || wallet.cards.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(children: [
                const Icon(Icons.local_cafe_outlined, size: 40, color: BrewColors.gold),
                const SizedBox(height: 12),
                Text(state.t(wallet == null ? 'wallet.loadError' : 'wallet.empty'), textAlign: TextAlign.center),
              ]),
            )
          else
            ...wallet.cards.map((card) => Padding(
                  padding: const EdgeInsets.only(bottom: 11),
                  child: LoyaltyCard(
                    card: card, now: state.time.now(), compact: true,
                    customerTier: tier,
                    tierLabel: state.t('tier.$tier'),
                    rewardText: '${state.t('wallet.reward')} · ${card.label(state.lang,at:state.time.now())}',
                    goalText: card.label(state.lang, at: state.time.now()),
                    archivedText: state.t('wallet.archived'),
                    onTap: card.archived
                        ? null
                        : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CodeScreen(card: card))),
                  ),
                )),
        ],
      ),
    );
  }
}

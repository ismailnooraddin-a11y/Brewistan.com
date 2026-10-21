import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../state/models.dart';
import 'code_screen.dart';
import 'settings_screen.dart';
import 'staff/staff_gate.dart';
import 'trophy_screen.dart';
import 'wallet_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  int _index = 0;
  bool _openingCard = false;

  /// Opens the card of the cafe whose notification was tapped.
  void _openFocusedCard(AppState state) {
    final focus = state.focusCafeId;
    final cards = state.wallet?.cards;
    if (focus == null || cards == null || _openingCard) return;
    CafeCard? match;
    for (final c in cards) {
      if (c.cafeId == focus && !c.archived) { match = c; break; }
    }
    if (match == null) return;
    final card = match;
    _openingCard = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _openingCard = false;
      if (!mounted) return;
      state.clearFocusCafe();
      setState(() => _index = 0);
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => CodeScreen(card: card)));
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.resumed) context.read<AppState>().refreshAll();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    _openFocusedCard(state);
    final pages = <Widget>[
      const WalletScreen(),
      const CodeScreen(),
      const TrophyScreen(),
      if (state.staff.isStaff) const StaffGate(),
      const SettingsScreen(),
    ];
    final destinations = <NavigationDestination>[
      NavigationDestination(icon: const Icon(Icons.style_outlined), selectedIcon: const Icon(Icons.style), label: state.t('nav.wallet')),
      NavigationDestination(icon: const Icon(Icons.qr_code_2), label: state.t('nav.code')),
      NavigationDestination(icon: const Icon(Icons.emoji_events_outlined), selectedIcon: const Icon(Icons.emoji_events), label: state.t('nav.trophies')),
      if (state.staff.isStaff)
        NavigationDestination(
          icon: Badge(isLabelVisible: state.pendingSync > 0, label: Text('${state.pendingSync}'), child: const Icon(Icons.qr_code_scanner)),
          label: state.t('nav.staff'),
        ),
      NavigationDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: state.t('nav.settings')),
    ];
    final index = _index.clamp(0, pages.length - 1);
    return Scaffold(
      body: SafeArea(child: KeyedSubtree(key: ValueKey('$index:${state.userId}'), child: pages[index])),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        destinations: destinations,
        onDestinationSelected: (i) => setState(() => _index = i),
      ),
    );
  }
}

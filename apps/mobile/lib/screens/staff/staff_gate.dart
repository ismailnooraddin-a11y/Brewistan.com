import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../theme.dart';
import 'scanner_screen.dart';

/// Staff mode opens only after the phone's own biometric or PIN check.
class StaffGate extends StatefulWidget {
  const StaffGate({super.key});
  @override
  State<StaffGate> createState() => _StaffGateState();
}

class _StaffGateState extends State<StaffGate> with WidgetsBindingObserver {
  final _auth = LocalAuthentication();
  bool _unlocked = false;
  String? _error;
  bool _unlocking = false;
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); }
  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); _auth.stopAuthentication(); super.dispose(); }
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && _unlocked && mounted) setState(() => _unlocked = false);
  }

  Future<void> _unlock() async {
    if (_unlocking) return;
    if (kIsWeb) {
      // No fingerprint or PIN check in the browser. Staff mode still locks
      // again whenever the app goes to the background.
      setState(() => _unlocked = true);
      return;
    }
    setState(() => _unlocking = true);
    final state = context.read<AppState>();
    try {
      if (!await _auth.isDeviceSupported()) {
        if (mounted) setState(() => _error = state.t('staff.noLock'));
        return;
      }
      final ok = await _auth.authenticate(
        localizedReason: state.t('staff.unlockReason'),
        options: const AuthenticationOptions(stickyAuth: true, biometricOnly: false),
      );
      if (!mounted) return;
      setState(() {
        _unlocked = ok;
        _error = ok ? null : state.t('staff.noLock');
      });
    } catch (e) {
      if (mounted) setState(() => _error = state.t('staff.noLock'));
    } finally { if (mounted) setState(() => _unlocking = false); }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    if (_unlocked) {
      return ScannerScreen(onLock: () => setState(() => _unlocked = false));
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.lock_outline, size: 48, color: BrewColors.gold),
          const SizedBox(height: 20),
          FilledButton.icon(onPressed: _unlocking ? null : _unlock, icon: const Icon(Icons.fingerprint), label: Text(state.t('staff.unlock'))),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: BrewColors.bad)),
          ],
        ]),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/crypto_service.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// The signed customer code, regenerated every 30-second window, fully offline.
class RotatingQr extends StatefulWidget {
  const RotatingQr({super.key, this.voucher, this.voucherExpiresAt});
  final String? voucher;
  final DateTime? voucherExpiresAt;

  @override
  State<RotatingQr> createState() => _RotatingQrState();
}

class _RotatingQrState extends State<RotatingQr> {
  Timer? _timer;
  String? _payload;
  int _window = -1;
  double _progress = 0;
  String? _identity;
  bool _signing = false;

  @override
  void initState() {
    super.initState();
    _tick();
    _timer = Timer.periodic(const Duration(milliseconds: 500), (_) => _tick());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _tick() async {
    final state = context.read<AppState>();
    if (!mounted || _signing) return;
    if (!state.keys.validAt(state.time.now()) || state.time.suspicious) {
      if (_payload != null) setState(() { _payload = null; _identity = null; });
      return;
    }
    final now = state.time.nowMs();
    final window = now ~/ 1000 ~/ 30;
    final progress = ((now ~/ 1000) % 30) / 30;
    final voucher = widget.voucherExpiresAt?.isAfter(state.time.now()) == false ? null : widget.voucher;
    final identity = '${state.userId}:${state.keys.cert}:$voucher';
    if (window != _window || identity != _identity) {
      _signing = true;
      try {
      _window = window;
      final payload = await buildCustomerQr(state.keys, state.time, voucher: voucher);
      if (!mounted || identity != '${state.userId}:${state.keys.cert}:${widget.voucherExpiresAt?.isAfter(state.time.now())==false?null:widget.voucher}') return;
      _identity = identity;
      setState(() {
        _payload = payload;
        _progress = progress;
      });
      } catch (_) { if (mounted) setState(() { _window = -1; _payload = null; }); }
      finally { _signing = false; }
    } else if (mounted) {
      setState(() => _progress = progress);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    if (!state.keys.validAt(state.time.now()) || state.time.suspicious || _payload == null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(state.t(state.time.suspicious ? 'code.clock' : 'code.preparing'), textAlign: TextAlign.center),
          const SizedBox(height: 12),
          TextButton(onPressed: state.refreshAll, child: Text(state.t('common.retry'))),
        ]),
      );
    }
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
        child: LayoutBuilder(builder: (context, constraints) => Semantics(
          label: state.t('code.title'),
          child: QrImageView(
          data: _payload!,
          version: QrVersions.auto,
          errorCorrectionLevel: QrErrorCorrectLevel.L,
          size: constraints.maxWidth.clamp(120.0, 280.0).toDouble(),
          backgroundColor: Colors.white,
        ))),
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: 200,
        child: LinearProgressIndicator(
          value: 1 - _progress,
          color: BrewColors.gold,
          backgroundColor: Colors.white10,
          minHeight: 3,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
      const SizedBox(height: 8),
      Text(state.t('code.refresh'), style: const TextStyle(color: BrewColors.muted, fontSize: 12)),
      if (state.time.suspicious) ...[
        const SizedBox(height: 12),
        Text(state.t('code.clock'), textAlign: TextAlign.center, style: const TextStyle(color: BrewColors.bad)),
      ],
    ]);
  }
}

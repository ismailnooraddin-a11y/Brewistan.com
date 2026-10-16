import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../l10n/strings.dart';
import '../../services/api.dart';
import '../../services/crypto_service.dart';
import '../../services/staff_service.dart';
import '../../state/app_state.dart';
import '../../theme.dart';

const _uuid = Uuid();

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key, required this.onLock});
  final VoidCallback onLock;

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  bool _busy = false;
  StaffCafe? _cafe;
  StaffBranch? _branch;

  @override
  void initState() {
    super.initState();
    _restoreSelection();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _restoreSelection() async {
    final state = context.read<AppState>();
    final snap = state.staff.snapshot;
    if (snap == null || snap.cafes.isEmpty) return;
    final saved = await state.db.kvGet('scanner_branch:${state.userId}');
    StaffCafe cafe = snap.cafes.first;
    StaffBranch? branch = cafe.branches.isNotEmpty ? cafe.branches.first : null;
    for (final c in snap.cafes) {
      for (final b in c.branches) {
        if (b.id == saved) {
          cafe = c;
          branch = b;
        }
      }
    }
    if (mounted) {
      setState(() {
        _cafe = cafe;
        _branch = branch;
      });
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy || _cafe == null) return;
    final raw = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (raw == null || !raw.startsWith('BW1~')) return;
    setState(() => _busy = true);
    await _controller.stop();
    try {
      await _handle(raw);
    } catch (_) {
      if (mounted) await _result(false, context.read<AppState>().t('staff.localError'));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        await _controller.start();
      }
    }
  }

  Future<void> _handle(String raw) async {
    final state = context.read<AppState>();
    final lang = state.lang;
    final userId = state.userId;
    final cafe = _cafe!;
    final branchId = _branch?.id;
    final snap = state.staff.snapshot;
    final scannerId = state.keys.deviceId;
    // Reading the clock updates rollback detection before the authorization check.
    final scannedMs = state.time.nowMs();
    if (userId == null || scannerId == null || branchId == null || snap == null ||
        snap.userId != userId || snap.deviceId != scannerId || snap.expired ||
        !snap.cafes.any((c) => c.id == cafe.id && c.branches.any((b) => b.id == branchId))) {
      return _result(false, errorMessage(lang, 'locked'));
    }
    late final ParsedQr parsed;
    try { parsed = await verifyCustomerQr(raw, scannedMs); }
    on QrException catch (e) { return _result(false, errorMessage(lang, e.code)); }
    if (parsed.userId == userId) return _result(false, errorMessage(lang, 'self_scan'));
    var online = false;
    try { online = (await Connectivity().checkConnectivity()).any((r) => r != ConnectivityResult.none); }
    catch (_) { /* Local queue remains available. */ }
    String? rewardId;
    Map<String, dynamic>? preview;
    if (online) {
      try {
        // Preview never mutates. A timeout here cannot have awarded a stamp.
        preview = await state.api.call('scan', body: {
          'qr': raw, 'cafeId': cafe.id, 'branchId': branchId,
          'action': 'preview', 'eventId': _uuid.v7(),
        }, timeout: const Duration(seconds: 6));
      } on ApiException catch (e) {
        if (!e.network) return _result(false, errorMessage(lang, e.code));
        online = false;
      }
    }
    final hasVoucher = parsed.voucherRewardId != null && parsed.voucherCafeId == cafe.id;
    if (preview?['availableRewardId'] != null || hasVoucher) {
      final choice = await _askRedeem(preview?['customerName'] as String? ?? '', _label(preview?['rewardLabel'], lang));
      if (choice == null || !mounted || state.userId != userId) return;
      if (choice) {
        // A durable redemption must carry the customer's signed reward voucher.
        // Ask for the cafe card's code rather than queue an unverifiable promise.
        if (!hasVoucher || (preview?['availableRewardId'] != null && parsed.voucherRewardId != preview!['availableRewardId'])) {
          return _result(false, state.t('staff.showRewardCode'));
        }
        rewardId = parsed.voucherRewardId;
      }
    }
    if (!mounted || state.userId != userId || snap.expired) return;
    final eventId = _uuid.v7(); // ONE id for persistence, online request, every retry.
    final type = rewardId == null ? 'stamp' : 'redeem';
    const baghdadOffset = 3 * 60 * 60 * 1000;
    final dayStartMs = ((scannedMs + baghdadOffset) ~/ 86400000) * 86400000 - baghdadOffset;
    try {
      await state.time.checkpoint();
      await state.db.enqueue(eventId: eventId, type: type, qr: raw, cafeId: cafe.id,
        branchId: branchId, rewardId: rewardId,
        scannedAt: DateTime.fromMillisecondsSinceEpoch(scannedMs, isUtc: true),
        staffId: userId, scannerDeviceId: scannerId, snapshot: snap.token,
        customerId: parsed.userId, offline: !online,
        cooldownMs: cafe.cooldownMinutes * 60000, dayStartMs: dayStartMs);
    } on StateError catch (e) { return _result(false, errorMessage(lang, e.message)); }
    state.notifyPendingChanged();
    if (!mounted || state.userId != userId) return; // old owner's queue is preserved
    if (online) {
      try {
        final response = await state.api.call('scan', body: {
          'qr': raw, 'cafeId': cafe.id, 'branchId': branchId,
          'action': type, 'eventId': eventId, if (rewardId != null) 'rewardId': rewardId,
        });
        // Ignore a late response after account switching; the old account can reconcile.
        if (!mounted || state.userId != userId) return;
        if (!['accepted','duplicate','rejected','voided','quarantined'].contains(response['status'])) {
          throw ApiException('invalid_response', 'The result is not confirmed.', network: true);
        }
        await state.db.completeEvents([{'eventId': eventId, 'status': response['status'],
          'reason': response['reason'], 'final': true}], userId);
        state.notifyPendingChanged();
        return _showServerResult(response);
      } on ApiException catch (e) {
        if (!e.network && !e.requiresReauthentication) {
          await state.db.completeEvents([{'eventId': eventId, 'status': 'rejected', 'reason': e.code, 'final': true}], userId);
          state.notifyPendingChanged();
          return _result(false, errorMessage(lang, e.code));
        }
      }
    }
    await state.db.releaseForSync(eventId, userId);
    state.notifyPendingChanged();
    return _result(true, state.t('staff.savedPending'), pending: true);
  }

  String _label(dynamic labels, String lang) {
    if (labels is Map) {
      final v = labels[lang] ?? labels['en'];
      if (v is String && v.isNotEmpty) return v;
    }
    return 'Free Coffee';
  }

  Future<void> _showServerResult(Map<String, dynamic> res) {
    final state = context.read<AppState>();
    final ok = res['status'] == 'accepted';
    final name = res['customerName'] as String? ?? '';
    if (!ok) return _result(false, '$name\n${errorMessage(state.lang, res['reason'] as String? ?? 'error')}');
    final lines = <String>[
      name,
      res['type'] == 'redeem' ? state.t('staff.redeemed') : state.t('staff.stamped'),
      if (res['puzzle_completed'] == true) state.t('staff.completed'),
      if (res['flagged'] == true) state.t('staff.flagged'),
    ];
    return _result(true, lines.where((l) => l.isNotEmpty).join('\n'));
  }

  Future<bool?> _askRedeem(String name, String label) {
    final state = context.read<AppState>();
    return showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(state.t('staff.redeemTitle')),
        content: Text([if (name.isNotEmpty) name, if (label.isNotEmpty) label, state.t('staff.redeemBody')].join('\n')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: Text(state.t('common.cancel'))),
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(state.t('staff.stampInstead'))),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: () => Navigator.pop(c, true),
            child: Text(state.t('staff.redeem')),
          ),
        ],
      ),
    );
  }

  Future<void> _result(bool ok, String message, {bool pending = false}) async {
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: pending ? const Color(0xFF352C19) : ok ? const Color(0xFF16301F) : const Color(0xFF3A1714),
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(pending ? Icons.schedule : ok ? Icons.check_circle : Icons.error_outline, size: 56, color: pending ? BrewColors.gold : ok ? BrewColors.good : BrewColors.bad),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18)),
            const SizedBox(height: 20),
            FilledButton(onPressed: () => Navigator.pop(c), child: Text(context.read<AppState>().t('common.ok'))),
          ]),
        ),
      ),
    );
  }

  Future<void> _showHistory() async {
    final state = context.read<AppState>();
    final id = state.userId;
    if (id == null) return;
    final rows = await state.db.recentResults(id);
    if (!mounted || state.userId != id) return;
    await showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (c) =>
      SafeArea(child: SizedBox(height: MediaQuery.sizeOf(c).height * 0.7, child: Column(children: [
        Padding(padding: const EdgeInsets.all(16), child: Text(state.t('staff.history'), style: Theme.of(c).textTheme.titleLarge)),
        if (rows.isEmpty) Padding(padding: const EdgeInsets.all(20), child: Text(state.t('staff.noHistory'))),
        Expanded(child: ListView.builder(itemCount: rows.length, itemBuilder: (c, i) {
          final row = rows[i];
          final status = row['status'] as String;
          final accepted = status == 'accepted';
          return ListTile(leading: Icon(accepted ? Icons.check_circle_outline : Icons.info_outline),
            title: Text('${row['type']} - $status'),
            subtitle: Text([if (row['reason'] != null) errorMessage(state.lang, row['reason'] as String),
              'ID: ${row['event_id']}'].join('\n')), isThreeLine: row['reason'] != null);
        })),
      ]))));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final snap = state.staff.snapshot;
    final branchIds = [for (final c in snap?.cafes ?? <StaffCafe>[]) for (final b in c.branches) b.id];
    final selectedId = branchIds.contains(_branch?.id) ? _branch?.id : null;
    final locked = snap == null || snap.expired || selectedId == null;

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
        child: Row(children: [
          Expanded(
            child: DropdownButton<String>(
              isExpanded: true,
              value: selectedId,
              hint: Text(state.t('staff.branch')),
              underline: const SizedBox.shrink(),
              items: [
                for (final c in snap?.cafes ?? <StaffCafe>[])
                  for (final b in c.branches)
                    DropdownMenuItem(value: b.id, child: Text('${c.name} · ${b.name}', overflow: TextOverflow.ellipsis)),
              ],
              onChanged: _busy ? null : (id) {
                for (final c in snap?.cafes ?? <StaffCafe>[]) {
                  for (final b in c.branches) {
                    if (b.id == id) {
                      setState(() {
                        _cafe = c;
                        _branch = b;
                      });
                      state.db.kvSet('scanner_branch:${state.userId}', b.id);
                    }
                  }
                }
              },
            ),
          ),
          if (state.pendingSync > 0)
            TextButton.icon(
              onPressed: () => state.sync.syncNow(),
              icon: const Icon(Icons.cloud_upload_outlined, size: 18),
              label: Text('${state.pendingSync} ${state.t('staff.pending')}'),
            ),
          IconButton(tooltip: state.t('staff.history'), onPressed: _showHistory, icon: const Icon(Icons.history)),
          IconButton(tooltip: state.t('staff.lock'), onPressed: widget.onLock, icon: const Icon(Icons.lock_outline)),
        ]),
      ),
      Expanded(
        child: locked
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(state.t('staff.locked'), textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: state.refreshStaff, child: Text(state.t('common.retry'))),
                  ]),
                ),
              )
            : Stack(children: [
                MobileScanner(controller: _controller, onDetect: _onDetect),
                Align(
                  alignment: Alignment.center,
                  child: Container(
                    width: 250,
                    height: 250,
                    decoration: BoxDecoration(
                      border: Border.all(color: BrewColors.gold, width: 2),
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 24,
                  child: Text(state.t('staff.scanning'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
                ),
                if (_busy) const Center(child: CircularProgressIndicator()),
              ]),
      ),
    ]);
  }
}

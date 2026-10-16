import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'local_db.dart';

/// A queue belongs to its original scanner account, never the next signed-in user.
class SyncService {
  SyncService(this._db, this._api, this._onChanged);
  final LocalDb _db;
  final Api _api;
  final void Function() _onChanged;
  StreamSubscription<List<ConnectivityResult>>? _sub;
  Timer? _timer;
  bool _running = false;
  String? _staffId;
  int _generation = 0;
  DateTime? lastSuccess;
  bool _valid(String id, int generation) => _staffId == id && generation == _generation &&
    Supabase.instance.client.auth.currentUser?.id == id;
  void start(String staffId) {
    if (_staffId != staffId) { stop(); _staffId = staffId; }
    _sub ??= Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) unawaited(syncNow());
    });
    _timer ??= Timer.periodic(const Duration(minutes: 2), (_) => unawaited(syncNow()));
    unawaited(syncNow());
  }
  void stop() {
    _generation++; _staffId = null;
    _sub?.cancel(); _timer?.cancel(); _sub = null; _timer = null;
    lastSuccess = null;
  }
  Future<int> syncNow() async {
    final id = _staffId;
    final generation = _generation;
    if (id == null) return 0;
    if (_running) return _db.pendingCount(id);
    _running = true;
    try {
      while (_valid(id, generation)) {
        final events = await _db.pendingEvents(100, id);
        if (events.isEmpty || !_valid(id, generation)) break;
        final res = await _api.call('sync-upload', body: {'events': events.map((e) => {
          'eventId': e['event_id'], 'type': e['type'], 'qr': e['qr'], 'cafeId': e['cafe_id'],
          'branchId': e['branch_id'], 'rewardId': e['reward_id'], 'scannedAt': e['scanned_at'],
          'staffId': e['staff_id'], 'scannerDeviceId': e['scanner_device_id'], 'snapshot': e['snapshot'],
        }).toList()});
        if (!_valid(id, generation)) break;
        final results = (res['results'] as List? ?? const []).map((r) => Map<String, dynamic>.from(r as Map)).toList();
        await _db.completeEvents(results, id);
        lastSuccess = DateTime.now();
        if (results.where((r) => r['final'] == true).length < events.length) break;
      }
      await _db.purge();
    } on ApiException { /* Retry unchanged IDs after ambiguous network outcomes. */ }
    catch (_) { /* Leave the durable queue intact on local storage/parsing failures. */ }
    finally { _running = false; _onChanged(); }
    return _valid(id, generation) ? _db.pendingCount(id) : 0;
  }
}

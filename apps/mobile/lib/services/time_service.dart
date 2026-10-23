import 'local_db.dart';

/// Corrects the device clock with the last known server offset, and flags
/// clocks that moved backwards or have not been corrected for 72 hours.
class TimeService {
  TimeService(this._db);
  final LocalDb _db;

  int _offsetMs = 0;
  int _lastSyncMs = 0;
  int _lastLocalMs = 0;
  bool movedBackwards = false;
  final Stopwatch _monotonic = Stopwatch();
  int _anchorLocal = 0;

  Future<void> load() async {
    _offsetMs = int.tryParse(await _db.kvGet('time_offset') ?? '') ?? 0;
    _lastSyncMs = int.tryParse(await _db.kvGet('time_last_sync') ?? '') ?? 0;
    _lastLocalMs = int.tryParse(await _db.kvGet('time_last_local') ?? '') ?? 0;
    final local = DateTime.now().millisecondsSinceEpoch;
    movedBackwards = (await _db.kvGet('time_rollback') ?? '') == '1';
    if (_lastLocalMs > 0 && local < _lastLocalMs - 60000) movedBackwards = true;
    if (movedBackwards) await _db.kvSet('time_rollback', '1');
    _anchorLocal = local; _monotonic..reset()..start();
    await _db.kvSet('time_last_local', '${local > _lastLocalMs ? local : _lastLocalMs}');
  }

  /// Corrected "now" in milliseconds since epoch.
  int nowMs() {
    final local = DateTime.now().millisecondsSinceEpoch;
    if (local < _lastLocalMs - 60000 || (_monotonic.isRunning && (local - _anchorLocal - _monotonic.elapsedMilliseconds).abs() > 60000)) movedBackwards = true;
    _lastLocalMs = local > _lastLocalMs ? local : _lastLocalMs;
    return local + _offsetMs;
  }

  DateTime now() => DateTime.fromMillisecondsSinceEpoch(nowMs(), isUtc: true);

  Future<void> updateFromServer(int serverTimeMs) async {
    final local = DateTime.now().millisecondsSinceEpoch;
    _offsetMs = serverTimeMs - local;
    _lastSyncMs = local;
    _lastLocalMs = local;
    movedBackwards = false;
    await _db.kvSet('time_rollback', '0');
    await _db.kvSet('time_offset', '$_offsetMs');
    await _db.kvSet('time_last_sync', '$_lastSyncMs');
    _anchorLocal = local; _monotonic..reset()..start();
    await _db.kvSet('time_last_local', '$local');
  }

  Future<void> checkpoint() async {
    final local = DateTime.now().millisecondsSinceEpoch;
    if (_lastLocalMs > 0 && local < _lastLocalMs - 60000) movedBackwards = true;
    _lastLocalMs = local > _lastLocalMs ? local : _lastLocalMs;
    await _db.kvSet('time_last_local', '$_lastLocalMs');
    if (movedBackwards) await _db.kvSet('time_rollback', '1');
  }

  bool get stale =>
      _lastSyncMs == 0 || DateTime.now().millisecondsSinceEpoch - _lastSyncMs > const Duration(hours: 72).inMilliseconds;

  bool get suspicious => movedBackwards || stale;
}

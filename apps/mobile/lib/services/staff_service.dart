import 'api.dart';
import 'crypto_service.dart';
import 'local_db.dart';
import 'time_service.dart';
class StaffBranch { StaffBranch(this.id, this.name); final String id; final String name; }
class StaffCafe {
  StaffCafe(this.id, this.name, this.branches, this.cooldownMinutes);
  final String id; final String name; final List<StaffBranch> branches; final int cooldownMinutes;
}
class StaffSnapshot {
  StaffSnapshot({required this.userId, required this.deviceId, required this.token,
    required this.cafes, required this.expiresAt, required TimeService time}) : _time = time;
  final String userId; final String deviceId; final String token;
  final List<StaffCafe> cafes; final DateTime expiresAt; final TimeService _time;
  bool get expired => _time.suspicious || !_time.now().isBefore(expiresAt);
}
class StaffService {
  StaffService(this._db, this._api, this._time);
  final LocalDb _db; final Api _api; final TimeService _time;
  String? _userId; String? _deviceId;
  StaffSnapshot? snapshot;
  bool get isStaff => snapshot != null && snapshot!.cafes.isNotEmpty;
  Future<void> loadCached(String userId, String? deviceId) async {
    _userId = userId; _deviceId = deviceId; snapshot = null;
    final token = await _db.kvGet('staff_snapshot:$userId');
    final parsed = token == null ? null : await _parse(token, userId, deviceId);
    if (_userId == userId && _deviceId == deviceId) snapshot = parsed;
  }
  Future<void> refresh(String userId, String? deviceId) async {
    if (deviceId == null || _userId != userId) return;
    _deviceId = deviceId;
    final res = await _api.call('staff-snapshot', body: {'scannerDeviceId': deviceId});
    final token = res['snapshot'] as String?;
    final parsed = token == null ? null : await _parse(token, userId, deviceId);
    if (_userId != userId || _deviceId != deviceId || parsed == null) return;
    if (res['serverTime'] is num) await _time.updateFromServer((res['serverTime'] as num).toInt());
    if (_userId != userId || _deviceId != deviceId) return;
    snapshot = parsed;
    await _db.kvSet('staff_snapshot:$userId', token);
  }
  Future<void> clear() async { _userId = null; _deviceId = null; snapshot = null; }
  Future<StaffSnapshot?> _parse(String token, String userId, String? deviceId) async {
    try {
      final data = await verifyPlatformToken(token);
      if (data == null || data['t'] != 'ss' || data['u'] != userId || data['d'] != deviceId || data['m'] is! List || data['s'] is! num || data['e'] is! num) return null;
      final start = (data['s'] as num).toInt(), end = (data['e'] as num).toInt() * 1000;
      if (end <= start || end - start > const Duration(hours: 72).inMilliseconds) return null;
      final cafes = (data['m'] as List).map((raw) {
        final m = Map<String, dynamic>.from(raw as Map);
        final branches = (m['b'] as List).map((b) => StaffBranch((b as Map)['i'] as String, b['n'] as String)).toList();
        return StaffCafe(m['c'] as String, m['n'] as String, branches, (m['cooldown'] as num?)?.toInt() ?? 120);
      }).where((c) => c.branches.isNotEmpty).toList();
      return StaffSnapshot(userId: userId, deviceId: deviceId!, token: token, cafes: cafes,
        expiresAt: DateTime.fromMillisecondsSinceEpoch(end, isUtc: true), time: _time);
    } catch (_) { return null; }
  }
}

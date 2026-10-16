import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import '../l10n/strings.dart';
import '../services/api.dart';
import '../services/b64.dart';
import '../services/crypto_service.dart';
import '../services/local_db.dart';
import '../services/push_service.dart';
import '../services/staff_service.dart';
import '../services/sync_service.dart';
import '../services/time_service.dart';
import 'models.dart';

enum AppPhase { loading, signedOut, needsProfile, ready }

class AppState extends ChangeNotifier {
  AppState(this.db)
      : api = Api(),
        time = TimeService(db),
        keys = DeviceKeys() {
    staff = StaffService(db, api, time);
    sync = SyncService(db, api, _refreshPending);
  }

  final LocalDb db;
  final Api api;
  final TimeService time;
  final DeviceKeys keys;
  final PushService push = PushService();
  late final StaffService staff;
  late final SyncService sync;

  AppPhase phase = AppPhase.loading;
  String lang = 'en';
  WalletData? wallet;
  bool walletFromCache = false;
  int pendingSync = 0;
  String? _userId;
  String? walletError;
  String? registrationError;
  int legacyPending = 0;
  int _generation = 0;
  int _walletRequest = 0;
  bool _disposed = false;
  StreamSubscription<AuthState>? _authSub;
  Timer? _expiryTimer;

  SupabaseClient get _client => Supabase.instance.client;
  String? get userId => _userId;

  String t(String key) => tr(lang, key);

  /// Arabic Material localizations are used for Sorani too (RTL); app text comes from strings.dart.
  Locale get materialLocale => Locale(lang == 'en' ? 'en' : 'ar');

  Future<void> bootstrap() async {
    _expiryTimer=Timer.periodic(const Duration(seconds:30),(_){if(phase==AppPhase.ready)notifyListeners();});
    lang = await db.kvGet('lang') ?? 'en';
    if (!supportedLangs.contains(lang)) lang = 'en';
    await time.load();
    await keys.load();
    legacyPending = await db.legacyPendingCount();
    _authSub = _client.auth.onAuthStateChange.listen((data) => unawaited(_onSession(data.session)));
    await _onSession(_client.auth.currentSession);
  }
  @override
  void notifyListeners() { if (!_disposed) super.notifyListeners(); }
  @override
  void dispose() {
    _disposed = true; _generation++;
    _expiryTimer?.cancel(); _authSub?.cancel(); sync.stop(); push.dispose();
    super.dispose();
  }
  bool _current(String id, int generation) => !_disposed && _userId == id && _generation == generation && _client.auth.currentUser?.id == id;

  Future<void> _onSession(Session? session) async {
    final id = session?.user.id;
    if (id == _userId && phase != AppPhase.loading && phase != AppPhase.signedOut) return;
    final generation = ++_generation;
    // Clear visible state before any asynchronous work on a different identity.
    _userId = id; wallet = null; walletError = null; registrationError = null; walletFromCache = false; pendingSync = 0;
    sync.stop(); await staff.clear();
    phase = id == null ? AppPhase.signedOut : AppPhase.loading;
    notifyListeners();
    await keys.bindUser(id);
    if (id == null || !_current(id, generation)) return;
    await staff.loadCached(id, keys.deviceId);
    if (!_current(id, generation)) return;
    try {
      final cached = await db.kvGet('wallet:$id');
      if (!_current(id, generation)) return;
      if (cached != null) {
        wallet = WalletData.fromJson(Map<String, dynamic>.from(jsonDecode(cached) as Map));
        walletFromCache = true;
      }
    } catch (_) { /* Bad cache is disposable; never substitute a different account. */ }
    final count = await db.pendingCount(id);
    if (!_current(id, generation)) return;
    pendingSync = count;
    final done = await db.kvGet('profile_done:$id');
    if (!_current(id, generation)) return;
    if (done == '1') { phase = AppPhase.ready; notifyListeners(); unawaited(refreshAll()); return; }
    try {
      final row = await _client.from('profiles').select('first_name').eq('id', id).single().timeout(const Duration(seconds: 10));
      if (!_current(id, generation)) return;
      final name = (row['first_name'] as String?)?.trim() ?? '';
      if (name.isNotEmpty) {
        await db.kvSet('profile_done:$id', '1');
        if (!_current(id, generation)) return;
        phase = AppPhase.ready; unawaited(refreshAll());
      } else { phase = AppPhase.needsProfile; }
    } catch (_) {
      if (!_current(id, generation)) return;
      phase = AppPhase.needsProfile;
    }
    notifyListeners();
  }

  Future<void> saveProfile(String first, String last) async {
    final id = _userId; final generation = _generation;
    if (id == null) throw ApiException('unauthorized', 'Sign in again.');
    if (first.trim().isEmpty || first.trim().length > 40 || last.trim().length > 40) throw ApiException('invalid_name', 'Check your name.');
    await _client.from('profiles').update({'first_name': first.trim(), 'last_name': last.trim(), 'locale': lang}).eq('id', id);
    if (!_current(id, generation)) return;
    await db.kvSet('profile_done:$id', '1');
    if (!_current(id, generation)) return;
    phase = AppPhase.ready; notifyListeners(); unawaited(refreshAll());
  }

  Future<void> refreshAll() async {
    final id = _userId; final generation = _generation;
    if (id == null) return;
    // Obtain trusted server time before producing a registration proof on a mis-set clock.
    await refreshWallet();
    if (!_current(id, generation)) return;
    await registerDevice();
    if (!_current(id, generation)) return;
    await refreshStaff();
    if (_current(id, generation)) sync.start(id);
  }

  Future<void> registerDevice({String? pushToken}) async {
    final id = _userId; final generation = _generation;
    if (id == null) return;
    try {
      final token = pushToken ?? await push.init(
        onTokenRefresh: (t) { if (_current(id, generation)) unawaited(registerDevice(pushToken: t)); },
        onMessage: (data) { unawaited(_handlePush(data, id, generation)); },
      );
      if (!_current(id, generation)) return;
      final access = _client.auth.currentSession?.accessToken;
      if (access == null || !_current(id, generation)) return;
      final claims = jsonDecode(utf8.decode(b64urlDecode(access.split('.')[1]))) as Map;
      final sessionId = claims['session_id'] as String;
      final proofAt = time.nowMs();
      final platform = Platform.isIOS ? 'ios' : 'android';
      final message = jsonEncode(['BW-REGISTER-1', id, sessionId, keys.publicKey, platform, keys.deviceId, token, proofAt]);
      final proof = b64urlEncode(await keys.sign(utf8.encode(message)));
      if (!_current(id, generation)) return;
      final res = await api.call('device-register', body: {
        'proof': proof, 'proofAt': proofAt,
        'publicKey': keys.publicKey, 'platform': Platform.isIOS ? 'ios' : 'android',
        'deviceId': keys.deviceId, 'pushToken': token, 'appVersion': AppConfig.appVersion, 'locale': lang,
      });
      if (!_current(id, generation)) return;
      await keys.saveRegistration(id, res['deviceId'] as String, res['cert'] as String, DateTime.parse(res['certExpiresAt'] as String));
      if (!_current(id, generation)) return;
      await time.updateFromServer((res['serverTime'] as num).toInt());
      registrationError=null;
      notifyListeners();
    } on ApiException catch(e) { if (_current(id,generation)) { registrationError=e.code; notifyListeners(); } }
    catch (_) { if (_current(id,generation)) { registrationError='registration_unavailable'; notifyListeners(); } }

  }

  Future<void> _handlePush(Map<String,dynamic> data, String id, int generation) async {
    if (!_current(id,generation) || data['userId'] != id || data['deliveryId'] is! String) return;
    try {
      if (await db.acceptPushDelivery(id,data['deliveryId'] as String) && _current(id,generation)) await refreshWallet();
    } catch (_) { /* Notification failures do not affect scans or durable queues. */ }
  }
  Future<void> resetDeviceRegistration() async {
    // Signing out first detaches the old push token and requires a fresh primary login.
    // Durable queues and their independent encryption key are never removed.
    final id = _userId;
    await signOut();
    await keys.rotateIdentity();
    await staff.clear();
    if (id != null) await db.kvSet('staff_snapshot:$id', null);
  }
  Future<void> signOut() async {
    final id = _userId; final device = keys.deviceId;
    sync.stop(); push.dispose();
    if (id != null && device != null) {
      try { await _client.rpc('detach_my_push',params:{'p_device':device}).timeout(const Duration(seconds:8)); } catch (_) {}
    }
    await push.removeToken();
    // Keep account-bound queues, encryption keys and cached evidence for later reconciliation.
    await _client.auth.signOut(scope: SignOutScope.local);
  }

  Future<void> refreshWallet() async {
    final id = _userId; final generation = _generation; final request = ++_walletRequest;
    if (id == null) return;
    try {
      final res = await api.call('wallet');
      final cards = List<dynamic>.from(res['cards'] as List? ?? const []);
      final seen = <String>{};
      var cursor = res['nextCursor'] as String?;
      while (cursor != null) {
        if (!_current(id, generation) || request != _walletRequest) return;
        if (!seen.add(cursor) || seen.length > 200) throw const FormatException('Wallet pagination did not complete');
        final page = await api.call('wallet', body: {'cursor': cursor});
        cards.addAll(page['cards'] as List? ?? const []);
        cursor = page['nextCursor'] as String?;
      }
      final unique = <String, dynamic>{};
      for (final row in cards) { unique[(row as Map)['cafeId'] as String] = row; }
      final sorted = unique.values.toList()..sort((a,b) {
        final archive = (a['archived'] == true ? 1 : 0).compareTo(b['archived'] == true ? 1 : 0);
        return archive != 0 ? archive : ((b['lastStampAt'] ?? '') as String).compareTo((a['lastStampAt'] ?? '') as String);
      });
      res['cards'] = sorted; res['nextCursor'] = null;
      final parsed = WalletData.fromJson(res);
      if (!_current(id, generation) || request != _walletRequest) return;
      wallet = parsed; walletFromCache = false; walletError = null;
      await db.kvSet('wallet:$id', jsonEncode(res));
      if (_current(id, generation) && res['serverTime'] is num) await time.updateFromServer((res['serverTime'] as num).toInt());
    } catch (_) {
      if (!_current(id, generation) || request != _walletRequest) return;
      walletFromCache = wallet != null; walletError = t('wallet.loadError');
    }
    notifyListeners();
  }

  Future<void> refreshStaff() async {
    final id = _userId; if (id == null) return;
    try { await staff.refresh(id, keys.deviceId); } catch (_) { /* Signed, account-bound cache only. */ }
    notifyListeners();
  }
  Future<void> _refreshPending() async {
    final id = _userId; final generation = _generation;
    if (id == null) return;
    final count = await db.pendingCount(id);
    if (!_current(id, generation)) return;
    pendingSync = count; notifyListeners();
  }
  void notifyPendingChanged() => unawaited(_refreshPending());

  Future<void> setLang(String value) async {
    if (!supportedLangs.contains(value)) return;
    lang = value;
    await db.kvSet('lang', value);
    notifyListeners();
    if (_userId != null) {
      try {
        await _client.from('profiles').update({'locale': value}).eq('id', _userId!);
      } catch (_) {}
    }
  }

  Future<void> setMuted(String cafeId, bool muted) async {
    if (muted) {
      try {
        await _client.from('notification_mutes').insert({'user_id': _userId, 'cafe_id': cafeId});
      } on PostgrestException catch (e) { if (e.code != '23505') rethrow; }
    } else {
      await _client.from('notification_mutes').delete().eq('user_id', _userId!).eq('cafe_id', cafeId);
    }
    await refreshWallet();
  }

  Future<void> deleteAccount() async {
    if (_userId == null) return;
    if (await db.pendingCount(_userId!) > 0) throw ApiException('pending_scans', t('staff.pendingDelete'));
    final deletedUser = _userId!;
    await api.call('account-delete');
    sync.stop();
    await db.kvSet('wallet:$deletedUser', null);
    await db.kvSet('staff_snapshot:$deletedUser', null);
    await db.kvSet('profile_done:$deletedUser', null);
    await staff.clear();
    wallet = null;
    await _client.auth.signOut();
  }
}

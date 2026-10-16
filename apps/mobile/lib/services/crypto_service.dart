import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import '../config.dart';
import 'b64.dart';
import 'secure_session_storage.dart';
import 'time_service.dart';

final _ed25519 = Ed25519();

class QrException implements Exception {
  QrException(this.code);
  final String code;
  @override
  String toString() => code;
}

/// Verifies a platform-signed token "<b64url(json)>.<b64url(sig)>" offline.
Future<Map<String, dynamic>?> verifyPlatformToken(String token) async {
  final parts = token.split('.');
  if (parts.length != 2) return null;
  try {
    final ok = await _ed25519.verify(
      utf8.encode(parts[0]),
      signature: Signature(
        b64urlDecode(parts[1]),
        publicKey: SimplePublicKey(b64urlDecode(AppConfig.platformPublicKey), type: KeyPairType.ed25519),
      ),
    );
    if (!ok) return null;
    return Map<String, dynamic>.from(jsonDecode(utf8.decode(b64urlDecode(parts[0]))) as Map);
  } catch (_) {
    return null;
  }
}

/// The install's Ed25519 key. The private seed never leaves secure storage.
class DeviceKeys {
  SimpleKeyPair? _keyPair;
  String? _boundUser;
  String? publicKey;
  String? deviceId;
  String? cert;
  DateTime? certExpiresAt;

  Future<void> load() async {
    final seed = await secureStorage.read(key: 'bw_device_seed');
    if (seed == null) {
      final kp = await _ed25519.newKeyPair();
      final bytes = await kp.extractPrivateKeyBytes();
      await secureStorage.write(key: 'bw_device_seed', value: b64urlEncode(bytes));
      _keyPair = kp;
    } else {
      _keyPair = await _ed25519.newKeyPairFromSeed(b64urlDecode(seed));
    }
    publicKey = b64urlEncode((await _keyPair!.extractPublicKey()).bytes);
  }

  Future<void> bindUser(String? userId) async {
    _boundUser = userId; deviceId = null; cert = null; certExpiresAt = null;
    if (userId == null) return;
    try {
      final raw = await secureStorage.read(key: 'bw_registration');
      if (raw == null || _boundUser != userId) return;
      final value = jsonDecode(raw) as Map;
      if (value['userId'] != userId) return;
      deviceId = value['deviceId'] as String;
      cert = value['cert'] as String;
      certExpiresAt = DateTime.tryParse(value['expiresAt'] as String);
    } catch (_) { deviceId = null; cert = null; certExpiresAt = null; }
  }

  bool get needsRenewal =>
      cert == null || certExpiresAt == null || certExpiresAt!.isBefore(DateTime.now().add(const Duration(days: 7)));

  bool get hasValidCert => validAt(DateTime.now());
  bool validAt(DateTime at) => cert != null && certExpiresAt != null && certExpiresAt!.isAfter(at);

  Future<void> rotateIdentity() async {
    final kp=await _ed25519.newKeyPair();
    await secureStorage.write(key:'bw_device_seed',value:b64urlEncode(await kp.extractPrivateKeyBytes()));
    await secureStorage.delete(key:'bw_registration');
    _keyPair=kp;publicKey=b64urlEncode((await kp.extractPublicKey()).bytes);
    deviceId=null;cert=null;certExpiresAt=null;
  }

  Future<void> saveRegistration(String userId, String id, String newCert, DateTime expiresAt) async {
    if (_boundUser != userId) return;
    final payload = await verifyPlatformToken(newCert);
    if (payload == null || payload['u'] != userId || payload['d'] != id || payload['k'] != publicKey) throw QrException('invalid_qr');
    if (_boundUser != userId) return;
    await secureStorage.write(key: 'bw_registration', value: jsonEncode({
      'userId': userId, 'deviceId': id, 'cert': newCert, 'expiresAt': expiresAt.toIso8601String(),
    }));
    if (_boundUser != userId) return;
    deviceId = id; cert = newCert; certExpiresAt = expiresAt;
  }

  Future<List<int>> sign(List<int> message) async {
    final sig = await _ed25519.sign(message, keyPair: _keyPair!);
    return sig.bytes;
  }
}

/// Builds the customer QR: BW1~<cert>~<window>~<voucher|0>~<signature>.
Future<String> buildCustomerQr(DeviceKeys keys, TimeService time, {String? voucher}) async {
  final window = time.nowMs() ~/ 1000 ~/ 30;
  final signed = 'BW1~${keys.cert}~$window~${voucher ?? '0'}';
  final sig = await keys.sign(utf8.encode(signed));
  return '$signed~${b64urlEncode(sig)}';
}

class ParsedQr {
  ParsedQr({required this.userId, required this.deviceId, required this.window, this.voucherRewardId, this.voucherCafeId});
  final String userId;
  final String deviceId;
  final int window;
  final String? voucherRewardId;
  final String? voucherCafeId;
}

/// Offline verification on the barista scanner.
Future<ParsedQr> verifyCustomerQr(String raw, int atMs) async {
  try {
  if (raw.length > 8192) throw QrException('invalid_qr');
  final parts = raw.trim().split('~');
  if (parts.length != 5 || parts[0] != 'BW1') throw QrException('invalid_qr');

  final cert = await verifyPlatformToken(parts[1]);
  if (cert == null || cert['t'] != 'dc' || cert['e'] is! num || cert['u'] is! String || cert['d'] is! String || cert['k'] is! String) throw QrException('invalid_qr');
  if ((cert['e'] as num) * 1000 <= atMs) throw QrException('cert_expired');

  final signed = utf8.encode('${parts[0]}~${parts[1]}~${parts[2]}~${parts[3]}');
  final ok = await _ed25519.verify(
    signed,
    signature: Signature(
      b64urlDecode(parts[4]),
      publicKey: SimplePublicKey(b64urlDecode(cert['k'] as String), type: KeyPairType.ed25519),
    ),
  );
  if (!ok) throw QrException('invalid_qr');

  final window = int.tryParse(parts[2]);
  final expected = atMs ~/ 1000 ~/ 30;
  if (window == null || (window - expected).abs() > 1) throw QrException('qr_expired');

  String? rewardId;
  String? cafeId;
  if (parts[3] != '0') {
    final v = await verifyPlatformToken(parts[3]);
    if (v != null && v['t'] == 'rv' && v['u'] == cert['u'] && v['e'] is num && v['r'] is String && v['c'] is String && (v['e'] as num) * 1000 > atMs) {
      rewardId = v['r'] as String;
      cafeId = v['c'] as String;
    }
  }
  return ParsedQr(
    userId: cert['u'] as String,
    deviceId: cert['d'] as String,
    window: window,
    voucherRewardId: rewardId,
    voucherCafeId: cafeId,
  );
  } on QrException { rethrow; } catch (_) { throw QrException('invalid_qr'); }
}

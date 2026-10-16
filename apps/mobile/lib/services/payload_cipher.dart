import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'b64.dart';

/// AES-256-GCM with per-write random nonce and account/record-bound associated data.
/// This protects payloads; SQLite indexes and operational metadata are not encrypted.
class PayloadCipher {
  PayloadCipher(List<int> key) : _key = SecretKey(key) {
    if (key.length != 32) throw ArgumentError('A 256-bit key is required');
  }
  final SecretKey _key;
  static final algorithm = AesGcm.with256bits();
  static const prefix = 'BWENC1.';
  static bool isEncrypted(String value) => value.startsWith(prefix);
  Future<String> seal(String value, String context) async {
    final box = await algorithm.encrypt(utf8.encode(value), secretKey: _key, aad: utf8.encode(context));
    return '$prefix${b64urlEncode(box.concatenation())}';
  }
  Future<String> open(String value, String context) async {
    if (!isEncrypted(value)) throw const FormatException('Unencrypted payload');
    final box = SecretBox.fromConcatenation(b64urlDecode(value.substring(prefix.length)), nonceLength: 12, macLength: 16);
    return utf8.decode(await algorithm.decrypt(box, secretKey: _key, aad: utf8.encode(context)));
  }
}

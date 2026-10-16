import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const secureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
);

/// Keeps the Supabase session (refresh token) in the iOS Keychain / Android Keystore.
/// The app never signs out by itself: the refresh token rotates on every use.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage();

  static const _key = 'bw_supabase_session';

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() => secureStorage.containsKey(key: _key);

  @override
  Future<String?> accessToken() => secureStorage.read(key: _key);

  @override
  Future<void> removePersistedSession() => secureStorage.delete(key: _key);

  @override
  Future<void> persistSession(String persistSessionString) =>
      secureStorage.write(key: _key, value: persistSessionString);
}

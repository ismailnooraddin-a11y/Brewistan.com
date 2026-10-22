import 'package:flutter/foundation.dart';

/// Build-time configuration, passed with --dart-define (see README).
class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Ed25519 platform public key (base64url). Verifies device certificates,
  /// reward vouchers and staff snapshots offline.
  static const platformPublicKey = String.fromEnvironment('PLATFORM_PUBLIC_KEY');

  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const firebaseAndroidAppId = String.fromEnvironment('FIREBASE_ANDROID_APP_ID');
  static const firebaseIosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
  static const firebaseWebAppId = String.fromEnvironment('FIREBASE_WEB_APP_ID');
  /// Web Push certificate key pair (Firebase console > Cloud Messaging > Web configuration).
  static const firebaseVapidKey = String.fromEnvironment('FIREBASE_VAPID_KEY');

  static const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.1');
  static const supportWhatsApp = String.fromEnvironment('SUPPORT_WHATSAPP');
  static const privacyUrl = String.fromEnvironment('PRIVACY_URL', defaultValue: 'https://dashboard.brewistan.com/privacy');

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty && platformPublicKey.isNotEmpty;

  static bool get pushConfigured =>
      firebaseApiKey.isNotEmpty && firebaseProjectId.isNotEmpty && firebaseSenderId.isNotEmpty &&
      (!kIsWeb || (firebaseWebAppId.isNotEmpty && firebaseVapidKey.isNotEmpty));

  /// Offline scanning rules (match the server defaults).
  static const offlineCooldown = Duration(hours: 2);
  static const offlineRedemptionsPerDay = 2;
}

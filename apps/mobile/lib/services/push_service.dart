import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../config.dart';

/// Firebase Cloud Messaging, configured from --dart-define values (no google-services files needed).
class PushService {
  bool _ready = false;
  StreamSubscription<String>? _tokenSub;
  StreamSubscription<RemoteMessage>? _messageSub;
  StreamSubscription<RemoteMessage>? _openedSub;
  void dispose() { _tokenSub?.cancel(); _messageSub?.cancel(); _openedSub?.cancel(); _tokenSub = null; }
  /// Web only, called from a button tap. Returns true when notifications are allowed.
  Future<bool> requestWebPermission() async {
    if (!kIsWeb || !_ready) return false;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      return settings.authorizationStatus == AuthorizationStatus.authorized;
    } catch (_) {
      return false;
    }
  }

  Future<void> removeToken() async { if (_ready) { try { await FirebaseMessaging.instance.deleteToken(); } catch (_) {} } }

  Future<String?> init({
    void Function(String token)? onTokenRefresh,
    void Function(Map<String,dynamic>)? onMessage,
    /// Called when the customer taps a notification (app in background or closed).
    void Function(Map<String,dynamic>)? onOpened,
  }) async {
    if (!AppConfig.pushConfigured) return null;
    try {
      if (!_ready) {
        await Firebase.initializeApp(
          options: FirebaseOptions(
            apiKey: AppConfig.firebaseApiKey,
            appId: kIsWeb
                ? AppConfig.firebaseWebAppId
                : (defaultTargetPlatform == TargetPlatform.iOS ? AppConfig.firebaseIosAppId : AppConfig.firebaseAndroidAppId),
            messagingSenderId: AppConfig.firebaseSenderId,
            projectId: AppConfig.firebaseProjectId,
          ),
        );
        _ready = true;

      }
      await _tokenSub?.cancel();
      if (onTokenRefresh != null) _tokenSub = FirebaseMessaging.instance.onTokenRefresh.listen(onTokenRefresh);
      await _messageSub?.cancel(); await _openedSub?.cancel();
      if (onMessage != null) {
        _messageSub = FirebaseMessaging.onMessage.listen((m) => onMessage(Map<String,dynamic>.from(m.data)));
        _openedSub = FirebaseMessaging.onMessageOpenedApp.listen((m) {
          final data = Map<String,dynamic>.from(m.data);
          onMessage(data);
          onOpened?.call(data);
        });
        final initial = await FirebaseMessaging.instance.getInitialMessage();
        if (initial != null) {
          final data = Map<String,dynamic>.from(initial.data);
          onMessage(data);
          onOpened?.call(data);
        }
      }
      if (kIsWeb) {
        // Browsers (especially iPhone) only allow the permission prompt after a tap,
        // so at start-up we only read a token if permission was already given.
        final settings = await FirebaseMessaging.instance.getNotificationSettings();
        if (settings.authorizationStatus != AuthorizationStatus.authorized) return null;
        return await FirebaseMessaging.instance.getToken(vapidKey: AppConfig.firebaseVapidKey);
      }
      await FirebaseMessaging.instance.requestPermission();
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('Push setup unavailable.');
      return null;
    }
  }
}

import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';

class ApiException implements Exception {
  ApiException(this.code, this.message, {this.network = false});
  final String code;
  final String message;

  /// True when the outcome is unknown (offline, timeout, transport failure).
  /// A timed-out request may already have committed; retry its original event ID.
  final bool network;
  bool get requiresReauthentication => ['unauthorized', 'session_required', 'session_revoked', 'recent_login_required', 'phone_verification_required', 'client_upgrade_required'].contains(code);

  @override
  String toString() => message;
}

/// Thin wrapper over Supabase Edge Functions.
class Api {
  SupabaseClient get _client => Supabase.instance.client;

  Future<Map<String, dynamic>> call(
    String function, {
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 12),
  }) async {
    try {
      final res = await _client.functions
          .invoke(function, body: body ?? const <String, dynamic>{})
          .timeout(timeout);
      final data = res.data;
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      if (data is String && data.isNotEmpty) return Map<String, dynamic>.from(jsonDecode(data) as Map);
      return <String, dynamic>{};
    } on FunctionException catch (e) {
      final details = e.details;
      var code = 'error';
      var message = e.reasonPhrase ?? 'Request failed';
      if (details is Map) {
        code = details['error']?.toString() ?? code;
        message = details['message']?.toString() ?? code;
      } else if (details is String && details.isNotEmpty) {
        try {
          final m = jsonDecode(details) as Map;
          code = m['error']?.toString() ?? code;
          message = m['message']?.toString() ?? code;
        } catch (_) {}
      }
      throw ApiException(code, message, network: e.status >= 500 || e.status == 408 || e.status == 429);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('offline', 'No connection', network: true);
    }
  }
}

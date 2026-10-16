import '../../services/digits.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../theme.dart';

/// Accepts 07XX XXX XXXX, 7XX…, 00964… or +964… and returns +9647XXXXXXXXX.
String toE164(String input) {
  var d = asciiDigits(input).replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('00')) d = d.substring(2);
  if (d.startsWith('0')) d = '964${d.substring(1)}';
  if (d.length == 10 && d.startsWith('7')) d = '964$d';
  return '+$d';
}

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});
  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _error;

  Future<void> _send() async {
    if (_busy) return;
    final phone = toE164(_phone.text);
    if (!RegExp(r'^\+\d{11,15}$').hasMatch(phone)) {
      if (mounted) setState(() => _error = 'Enter a valid phone number.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithOtp(phone: phone);
      if (mounted) setState(() => _codeSent = true);
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No connection. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    if (_busy || !RegExp(r'^\d{6}$').hasMatch(asciiDigits(_code.text).trim())) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.verifyOTP(
        type: OtpType.sms,
        phone: toE164(_phone.text),
        token: asciiDigits(_code.text).trim(),
      );
      // AppState reacts to the new session.
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No connection. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: [
            Row(children: [
              const Text('Brewistan', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w600, color: BrewColors.cream)),
              const Spacer(),
              DropdownButton<String>(
                value: state.lang,
                underline: const SizedBox.shrink(),
                items: supportedLangs.map((l) => DropdownMenuItem(value: l, child: Text(langNames[l]!))).toList(),
                onChanged: (v) => v == null ? null : state.setLang(v),
              ),
            ]),
            Text(state.t('app.tagline'), style: const TextStyle(color: BrewColors.gold, letterSpacing: 1.2)),
            const SizedBox(height: 48),
            Text(state.t(_codeSent ? 'auth.codeTitle' : 'auth.phoneTitle'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(state.t(_codeSent ? 'auth.codeBody' : 'auth.phoneBody'), style: const TextStyle(color: BrewColors.muted)),
            const SizedBox(height: 24),
            if (!_codeSent)
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  decoration: InputDecoration(labelText: state.t('auth.phone'), hintText: '0750 123 4567'),
                ),
              )
            else
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  autofocus: true,
                  textAlign: TextAlign.center,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  style: const TextStyle(fontSize: 24, letterSpacing: 12),
                  onChanged: (v) => v.length == 6 ? _verify() : null,
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: BrewColors.bad)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : (_codeSent ? _verify : _send),
              child: _busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(state.t(_codeSent ? 'auth.verify' : 'auth.send')),
            ),
            if (_codeSent)
              TextButton(
                onPressed: _busy ? null : () => setState(() {
                  _codeSent = false;
                  _code.clear();
                }),
                child: Text(state.t('auth.change')),
              ),
          ],
        ),
      ),
    );
  }
}

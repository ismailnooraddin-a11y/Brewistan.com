import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'screens/auth/phone_screen.dart';
import 'screens/auth/profile_screen.dart';
import 'screens/home_shell.dart';
import 'services/local_db.dart';
import 'services/secure_session_storage.dart';
import 'state/app_state.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!AppConfig.isConfigured) {
    runApp(const _MissingConfigApp());
    return;
  }
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(localStorage: SecureSessionStorage()),
  );
  late final LocalDb db;
  try { db = await LocalDb.open(); }
  catch (_) {
    runApp(const MaterialApp(home: Scaffold(body: SafeArea(child: Padding(padding: EdgeInsets.all(24),
      child: Center(child: SelectableText('Saved data could not be opened securely. Restart the app and unlock your phone. If this continues, contact Brewistan support. Do not clear app storage or uninstall: pending scans may need recovery.')))))));
    return;
  }
  final state = AppState(db);
  runApp(ChangeNotifierProvider.value(value: state, child: const BrewistanApp()));
  unawaited(state.bootstrap());
}

class BrewistanApp extends StatelessWidget {
  const BrewistanApp({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return MaterialApp(
      title: 'Brewistan',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      locale: state.materialLocale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: switch (state.phase) {
        AppPhase.loading => const Scaffold(body: Center(child: CircularProgressIndicator())),
        AppPhase.signedOut => const PhoneScreen(),
        AppPhase.needsProfile => const ProfileScreen(),
        AppPhase.ready => const HomeShell(),
      },
    );
  }
}

class _MissingConfigApp extends StatelessWidget {
  const _MissingConfigApp();

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Build is missing configuration. Pass SUPABASE_URL, SUPABASE_ANON_KEY and PLATFORM_PUBLIC_KEY with --dart-define (see README).',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

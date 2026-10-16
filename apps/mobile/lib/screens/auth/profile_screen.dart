import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _first = TextEditingController();
  final _last = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _save() async {
    if (_first.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().saveProfile(_first.text, _last.text);
    } catch (e) {
      setState(() => _error = 'Could not save. Check your connection.');
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
          padding: const EdgeInsets.fromLTRB(24, 64, 24, 24),
          children: [
            Text(state.t('profile.title'), style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(state.t('profile.body'), style: const TextStyle(color: BrewColors.muted)),
            const SizedBox(height: 24),
            TextField(
              controller: _first,
              maxLength: 40,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: state.t('profile.first')),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _last,
              maxLength: 40,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: state.t('profile.last')),
            ),
            if (_error != null) Text(_error!, style: const TextStyle(color: BrewColors.bad)),
            const SizedBox(height: 16),
            FilledButton(onPressed: _busy ? null : _save, child: Text(state.t('profile.save'))),
          ],
        ),
      ),
    );
  }
}

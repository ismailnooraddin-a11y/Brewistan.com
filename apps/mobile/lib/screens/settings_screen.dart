import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import 'devices_screen.dart';
import '../l10n/strings.dart';
import '../services/api.dart';
import '../state/app_state.dart';
import '../theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _delete(BuildContext context, AppState state) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(state.t('settings.delete')),
        content: Text(state.t('settings.deleteConfirm')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(state.t('common.cancel'))),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: Text(state.t('common.delete'), style: const TextStyle(color: BrewColors.bad)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await state.deleteAccount();
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _signOut(BuildContext context, AppState state) async {
    final yes=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(
      title:Text(state.t('settings.signout')),content:Text(state.t('settings.signoutWarning')),
      actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:Text(state.t('common.cancel'))),
       TextButton(onPressed:()=>Navigator.pop(c,true),child:Text(state.t('settings.signout')))]));
    if(yes!=true)return;
    try{await state.signOut();}catch(_){if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(state.t('common.saveError'))));}
  }
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cards = (state.wallet?.cards ?? []).where((c) => !c.archived).toList();
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 16),
      children: [
        ListTile(
          leading: const Icon(Icons.language),
          title: Text(state.t('settings.language')),
          trailing: DropdownButton<String>(
            value: state.lang,
            underline: const SizedBox.shrink(),
            items: supportedLangs.map((l) => DropdownMenuItem(value: l, child: Text(langNames[l]!))).toList(),
            onChanged: (v) => v == null ? null : state.setLang(v),
          ),
        ),
        if (cards.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
            child: Text(state.t('settings.notifications'), style: const TextStyle(color: BrewColors.muted)),
          ),
          for (final c in cards)
            SwitchListTile(
              value: !c.muted,
              title: Text(c.name),
              activeColor: BrewColors.gold,
              onChanged: (on) async {
                try { await state.setMuted(c.cafeId, !on); } catch (_) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.t('common.saveError'))));
                }
              },
            ),
        ],
        if (state.legacyPending > 0) ListTile(leading: const Icon(Icons.warning_amber), title: Text(state.t('staff.legacyQueue')), subtitle: Text('${state.legacyPending}')),
        ListTile(leading:const Icon(Icons.devices),title:Text(state.t('settings.devices')),
          onTap:()=>Navigator.push(context,MaterialPageRoute<void>(builder:(_)=>const DevicesScreen()))),
        ListTile(leading:const Icon(Icons.logout),title:Text(state.t('settings.signout')),onTap:()=>_signOut(context,state)),
        const Divider(height: 40),
        ListTile(
          leading: const Icon(Icons.privacy_tip_outlined),
          title: Text(state.t('settings.privacy')),
          subtitle: const Text(AppConfig.privacyUrl),
        ),
        ListTile(
          leading: const Icon(Icons.delete_outline, color: BrewColors.bad),
          title: Text(state.t('settings.delete'), style: const TextStyle(color: BrewColors.bad)),
          onTap: () => _delete(context, state),
        ),
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: Text(state.t('settings.version')),
          trailing: const Text(AppConfig.appVersion),
        ),
      ],
    );
  }
}

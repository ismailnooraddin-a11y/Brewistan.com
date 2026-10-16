import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../state/app_state.dart';
class DevicesScreen extends StatefulWidget {
 const DevicesScreen({super.key});
 @override State<DevicesScreen> createState()=>_DevicesScreenState();
}
class _DevicesScreenState extends State<DevicesScreen> {
 List<Map<String,dynamic>>? _devices; bool _busy=false; String? _error;
 @override void initState(){super.initState();_load();}
 Future<void> _load() async {
  try {final user=Supabase.instance.client.auth.currentUser;
   if(user==null)return;
   final rows=await Supabase.instance.client.from('devices').select('id,platform,last_seen_at').eq('user_id',user.id).isFilter('revoked_at',null).order('last_seen_at',ascending:false).limit(20);
   if(mounted)setState((){_devices=List<Map<String,dynamic>>.from(rows);_error=null;});
  }catch(_){if(mounted)setState(()=>_error=context.read<AppState>().t('common.saveError'));}
 }
 Future<void> _revoke(String id) async {
  final state=context.read<AppState>();final current=id==state.keys.deviceId;
  final yes=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(
   title:Text(state.t('settings.revokeDevice')),content:Text(state.t('settings.revokeWarning')),
   actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:Text(state.t('common.cancel'))),
   TextButton(onPressed:()=>Navigator.pop(c,true),child:Text(state.t('settings.revokeDevice')))]));
  if(yes!=true||!mounted)return;setState(()=>_busy=true);
  try{await Supabase.instance.client.rpc('revoke_my_device',params:{'p_device':id});
   if(current){await state.signOut();if(mounted)Navigator.pop(context);}else{await _load();}
  }catch(_){if(mounted)setState(()=>_error=state.t('common.saveError'));}
  finally{if(mounted)setState(()=>_busy=false);}
 }
 @override Widget build(BuildContext context){final state=context.watch<AppState>();return Scaffold(
  appBar:AppBar(title:Text(state.t('settings.devices'))),body:RefreshIndicator(onRefresh:_load,child:ListView(
   padding:const EdgeInsets.all(16),children:[
   if(_error!=null)Text(_error!,semanticsLabel:_error),
   if(state.registrationError!=null) ...[
    Text(state.registrationError!),
    TextButton(onPressed:_busy?null:()async{
      final yes=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(
       title:Text(state.t('settings.renewDevice')),content:Text(state.t('settings.renewWarning')),
       actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:Text(state.t('common.cancel'))),
        TextButton(onPressed:()=>Navigator.pop(c,true),child:Text(state.t('common.retry')))]));
      if(yes!=true||!mounted)return;setState(()=>_busy=true);
      try{await state.resetDeviceRegistration();if(mounted)Navigator.pop(context);}catch(_){if(mounted)setState(()=>_error=state.t('settings.renewWarning'));}
      finally{if(mounted)setState(()=>_busy=false);}
     },child:Text(state.t('settings.renewDevice'))),
   ],
   if(_devices==null&&_error==null)const Center(child:CircularProgressIndicator()),
   for(final d in _devices??<Map<String,dynamic>>[])ListTile(
    leading:const Icon(Icons.smartphone),title:Text('${d['platform']}${d['id']==state.keys.deviceId?' (${state.t('settings.thisDevice')})':''}'),
    subtitle:Text('${d['last_seen_at']??''}'),
    trailing:IconButton(tooltip:state.t('settings.revokeDevice'),onPressed:_busy?null:()=>_revoke(d['id'] as String),icon:const Icon(Icons.block))),
  ])));}
}

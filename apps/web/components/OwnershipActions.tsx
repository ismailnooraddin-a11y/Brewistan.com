"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
export function OwnershipActions({id,recipient=false,admin=false}:{id:string;recipient?:boolean;admin?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function act(accept:boolean){
  const reason=admin?prompt('Record the evidence used to verify both parties and the transfer (10+ characters):'):null;
  if(admin&&(!reason||reason.trim().length<10))return;
  if(!confirm(admin?'Complete the transfer? The previous owner will lose access.':accept?'Accept responsibility for this cafe? An administrator must still approve.':'Cancel this transfer request?'))return;
  setBusy(true);setError('');try{
   const {error}=admin?await createClient().rpc('complete_ownership_transfer',{p_transfer:id,p_reason:reason}):
    await createClient().rpc('respond_ownership_transfer',{p_transfer:id,p_accept:accept});
   if(error)throw error;router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'The change was not saved. Refresh and retry.');}finally{setBusy(false);}
 }
 return <div className="space-y-2"><div className="flex flex-wrap gap-2">
 {(recipient||admin)&&<button disabled={busy} className="btn-gold" onClick={()=>act(true)}>{admin?'Complete transfer':'Accept transfer'}</button>}
 {!admin&&<button disabled={busy} className="btn-ghost" onClick={()=>act(false)}>Cancel request</button>}</div>
 {error&&<p role="alert">{error}</p>}</div>;
}
export function RequestOwnership({cafeId}:{cafeId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const router=useRouter();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');
  const phone=String(new FormData(e.currentTarget).get('phone')??'');try{
   const {error}=await createClient().rpc('request_ownership_transfer',{p_cafe:cafeId,p_phone:phone});
   if(error)throw error;setMessage('Request created. Ask the recipient to sign in and open /ownership to accept.');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Request failed. Check the verified phone number or cancel the previous request.');}finally{setBusy(false);}}
 return <form onSubmit={submit} className="card space-y-3"><h2 className="text-lg">Transfer ownership</h2>
 <p>Both parties must have verified accounts. The recipient must accept, then an MFA-authenticated administrator verifies and completes the transfer.</p>
 <label className="block">New owner phone number<input className="input" name="phone" type="tel" required dir="ltr" maxLength={30}/></label>
 <button disabled={busy} className="btn-gold">Request transfer</button>{message&&<p role="status">{message}</p>}</form>;
}

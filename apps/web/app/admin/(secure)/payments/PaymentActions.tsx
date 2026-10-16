"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
export function PaymentActions({reportId,legacy=false,amount}:{reportId:string;legacy?:boolean;amount:number}){
 const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function review(approve:boolean){
  if(!confirm(approve?'Have you verified this reference and exact amount in the merchant account? Confirm and extend the plan?':'Reject this payment report?'))return;
  const reason=approve&&legacy?prompt('Legacy report: describe the evidence for the historical quoted amount (10+ characters). Do not guess.'):null;
  if(approve&&legacy&&(!reason||reason.trim().length<10))return;
  setBusy(true);setMessage('');try{
   if(approve&&legacy){const {error}=await createClient().rpc('admin_reconcile_legacy_payment',{p_report:reportId,p_required:amount,p_reason:reason});if(error)throw error;}
   const {error}=await createClient().rpc('admin_review_payment',{p_report:reportId,p_approve:approve});
   if(error)throw error;router.refresh();
  }catch(e){setMessage(e&&typeof e==='object'&&'message' in e?String(e.message):'Review failed. Refresh and retry.');}finally{setBusy(false);}
 }
 return <div className="space-y-2"><div className="flex justify-end gap-2">
 <button className="btn-gold" disabled={busy} onClick={()=>review(true)}>{legacy?'Review legacy quote':'Confirm'}</button>
 <button className="btn-danger" disabled={busy} onClick={()=>review(false)}>Reject</button></div>{message&&<p role="alert" className="max-w-sm text-sm">{message}</p>}</div>;
}

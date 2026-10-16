"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatIqd,formatDate } from '@/components/ui';
import { asciiDigits } from '@/lib/validation';
type Quote = { id: string; required_iqd: number; expires_at: string; months: number };
export function PaymentForm({ cafeId, zainCash, fib, monthly, support }: {
 cafeId: string; zainCash: string; fib: string; monthly: number; support: string;
}) {
 const router=useRouter(); const [months,setMonths]=useState(1); const [quote,setQuote]=useState<Quote|null>(null);
 const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const generation=useRef(0); const [supportQuote,setSupportQuote]=useState('');
 useEffect(()=>{
  const id=++generation.current; setQuote(null); setMessage('');
  void (async()=>{try {
   const {data,error}=await createClient().rpc('create_payment_quote',{p_cafe:cafeId,p_months:months});
   if(error) throw error; if(id===generation.current) setQuote(data as Quote);
  }catch{if(id===generation.current)setMessage('The quote could not be loaded. Refresh before making a payment.');}})();
  return ()=>{generation.current++;};
 },[cafeId,months]);
 async function loadSupportQuote(){
  if(!/^[0-9a-f-]{36}$/i.test(supportQuote)){setMessage('Enter the quote ID provided by support.');return;}
  setBusy(true);try{
   const {data,error}=await createClient().from('payment_quotes').select('id,months,required_iqd,expires_at')
    .eq('id',supportQuote).eq('cafe_id',cafeId).is('used_at',null).gt('expires_at',new Date().toISOString()).single();
   if(error||!data)throw new Error('This quote is unavailable, used or expired.');
   generation.current++;setQuote(data as Quote);setMessage('Support quote loaded. Check the amount and period before paying.');
  }catch(e){setMessage(e instanceof Error?e.message:'Quote could not be loaded.');}finally{setBusy(false);}
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault(); if(!quote||busy)return; const form=e.currentTarget; const f=new FormData(form);
  setBusy(true);setMessage('');
  try {
   const amount=Number(asciiDigits(String(f.get('amount')??'')).trim());
   if(!Number.isSafeInteger(amount)||amount!==quote.required_iqd)throw new Error('Pay exactly the quoted amount. Contact support about a different amount.');
   const {error}=await createClient().rpc('submit_payment_report',{p_quote:quote.id,p_method:f.get('method'),p_amount:amount,p_reference:String(f.get('reference')??'').trim()});
   if(error)throw error;setMessage('Payment report saved. Awaiting merchant verification.');form.reset();router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'The report was not saved. Retry with the same reference.');}
  finally{setBusy(false);}
 }
 return <div className="card grid gap-6 md:grid-cols-2">
  <section className="space-y-3 text-sm"><h2 className="text-lg">Payment instructions</h2>
   <p>Zain Cash: <span dir="ltr">{zainCash||'Contact support for verified payment details'}</span></p>
   <p>FIB: <span dir="ltr">{fib||'Contact support for verified payment details'}</span></p>
   <p>Obtain a quote below before paying. Include your cafe name in the note.</p>
   <p>WhatsApp support: <span dir="ltr">{support||'Use your Brewistan support contact'}</span></p>
   <p className="text-ink-muted">Standard price: {formatIqd(monthly)} per month. Existing quotes retain their recorded price.</p>
  </section>
  <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
   <h2 className="text-lg">Report a payment</h2>
   <label className="block">Period<select className="input" value={months} disabled={busy} onChange={e=>setMonths(Number(e.target.value))}>
    {[1,3,6,12].map(m=><option key={m} value={m}>{m} month{m>1?'s':''}</option>)}</select></label>
   {quote&&<p role="status">Quote: <strong>{formatIqd(quote.required_iqd)}</strong>. Period: {quote.months} month(s). Expires {formatDate(quote.expires_at,true)} (Baghdad).</p>}
   <details><summary>Use a quote from support</summary><label className="block">Support quote ID<input value={supportQuote} onChange={e=>setSupportQuote(e.target.value.trim())} className="input" dir="ltr" maxLength={36}/></label>
    <button type="button" disabled={busy} className="btn-ghost" onClick={loadSupportQuote}>Load quote</button></details>
   <label className="block">Method<select name="method" className="input" required><option value="zain_cash">Zain Cash</option><option value="fib">FIB</option><option value="bank_transfer">Bank transfer</option></select></label>
   <label className="block">Amount (IQD)<input name="amount" inputMode="numeric" className="input" required /></label>
   <label className="block">Transaction reference<input name="reference" className="input" dir="ltr" required minLength={3} maxLength={100}/></label>
   {message&&<p role="status" aria-live="polite" className="text-sm">{message}</p>}
   <button className="btn-primary" disabled={busy||!quote}>{busy?'Saving...':'Submit payment report'}</button>
  </form>
 </div>;
}

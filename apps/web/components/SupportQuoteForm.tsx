"use client";
import {useState} from 'react';import {createClient} from '@/lib/supabase/client';import {asciiDigits} from '@/lib/validation';
export function SupportQuoteForm(){const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setMessage('');
 try{const amount=Number(asciiDigits(String(f.get('amount')))),months=Number(f.get('months'));
  if(!Number.isSafeInteger(amount)||amount<1)throw new Error('Enter a positive integer IQD amount.');
  const {data,error}=await createClient().rpc('admin_quote_payment',{p_cafe:f.get('cafe'),p_months:months,p_amount:amount,p_reason:f.get('reason')});
  if(error)throw error;setMessage('Quote ID: '+data+'. Valid for 24 hours. Give it to the owner to load under Billing > Use a quote from support.');
 }catch(e){setMessage(e&&typeof e==='object'&&'message' in e?String(e.message):'Quote was not created.');}finally{setBusy(false);}}
 return <form onSubmit={submit} className="card space-y-4"><h2 className="text-lg">Evidence-backed payment exception</h2>
 <label className="block">Cafe ID<input className="input" name="cafe" required pattern="[0-9a-fA-F-]{36}" dir="ltr"/></label>
 <div className="grid gap-4 sm:grid-cols-2"><label>Months<input className="input" name="months" type="number" min={1} max={12} defaultValue={1} required/></label>
 <label>Total amount (IQD)<input className="input" name="amount" inputMode="numeric" required/></label></div>
 <label className="block">Evidence and reason<textarea className="input" name="reason" minLength={10} maxLength={1000} required/></label>
 <button className="btn-gold" disabled={busy}>Create recorded quote</button>{message&&<p role="status" className="break-words">{message}</p>}</form>;}

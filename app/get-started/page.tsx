'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { ArrowLeft, Coffee, Eye, EyeOff, Mail, Phone } from 'lucide-react';

type Tab = 'create' | 'signin' | 'staff';

export default function GetStarted(){
 const supabase = createClient();
 const [tab,setTab]=useState<Tab>('create');
 const [show,setShow]=useState(false);
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

 async function createCafe(e: React.FormEvent<HTMLFormElement>){
  e.preventDefault(); setLoading(true); setMessage('');
  const form = new FormData(e.currentTarget);
  const email = String(form.get('email')||''); const password = String(form.get('password')||'');
  const fullName = String(form.get('full_name')||'');
  const { data, error } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo:`${siteUrl}/auth/callback`, data:{ full_name: fullName, phone:String(form.get('owner_phone')||'') } } });
  if(error){ setMessage(error.message); setLoading(false); return; }
  if(data.user){
    await supabase.from('profiles').upsert({ id:data.user.id, full_name:fullName, email, phone:String(form.get('owner_phone')||''), role:'cafe_owner' });
    const { error:cafeError } = await supabase.from('cafes').insert({ owner_id:data.user.id, cafe_name:String(form.get('cafe_name')||''), address:String(form.get('address')||''), contact_phone:String(form.get('cafe_phone')||''), contact_email:email, city:String(form.get('city')||'Erbil') });
    if(cafeError){ setMessage(cafeError.message); setLoading(false); return; }
  }
  setMessage('Account created. Check your email to confirm your account, then sign in.'); setLoading(false);
 }
 async function signIn(e: React.FormEvent<HTMLFormElement>){
  e.preventDefault(); setLoading(true); setMessage(''); const form = new FormData(e.currentTarget);
  const { error } = await supabase.auth.signInWithPassword({ email:String(form.get('email')||''), password:String(form.get('password')||'') });
  if(error){ setMessage(error.message); setLoading(false); return; }
  window.location.href='/dashboard';
 }
 async function google(){ await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${siteUrl}/auth/callback` } }); }
 async function forgot(){
  const email = prompt('Enter your email address'); if(!email) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${siteUrl}/reset-password`});
  setMessage(error?error.message:'Password reset link sent. Check your email.');
 }
 return <main className="auth-layout"><aside className="auth-side"><div><Link href="/" className="brand" style={{color:'white'}}><span className="mark">B</span>Brewistan</Link><h1>Open your café loyalty system today.</h1><p style={{color:'rgba(255,255,255,.72)'}}>Create your café profile, choose your card design, add staff, and launch your first campaign from one polished dashboard.</p></div><div className="panel" style={{background:'rgba(255,255,255,.08)',borderColor:'rgba(255,255,255,.14)',boxShadow:'none'}}><Coffee/><h3 style={{color:'white'}}>Setup target: 5 minutes</h3><p style={{color:'rgba(255,255,255,.72)'}}>No app store, no wallet dependency, no paper cards. Perfect for cafés in Iraq.</p></div></aside><section className="auth-main"><div className="auth-card"><Link className="pill" href="/"><ArrowLeft size={14}/> Back to website</Link><h1 style={{fontSize:32,letterSpacing:'-.06em',margin:'20px 0 8px'}}>Get started with Brewistan</h1><p className="hint">Create a café account, sign in, or let staff access their approval screen.</p><div className="tabs"><button className={`tab ${tab==='create'?'active':''}`} onClick={()=>setTab('create')}>Create café</button><button className={`tab ${tab==='signin'?'active':''}`} onClick={()=>setTab('signin')}>Cafe sign in</button><button className={`tab ${tab==='staff'?'active':''}`} onClick={()=>setTab('staff')}>Staff sign in</button></div>{message&&<div className="panel" style={{padding:14,marginBottom:14}}>{message}</div>}{tab==='create'&&<form onSubmit={createCafe} className="form-grid"><div className="field"><label>Owner full name</label><input name="full_name" required placeholder="Example: Ismail Noor"/></div><div className="field"><label>Owner phone number</label><input name="owner_phone" required placeholder="+964 750 000 0000"/></div><div className="field"><label>Email address</label><input name="email" required type="email" placeholder="owner@cafe.com"/></div><div className="field"><label>Password</label><div style={{position:'relative'}}><input name="password" required minLength={8} type={show?'text':'password'} placeholder="Minimum 8 characters" style={{width:'100%'}}/><button type="button" onClick={()=>setShow(!show)} style={{position:'absolute',right:10,top:10,border:0,background:'transparent'}}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div><div className="field"><label>Café name</label><input name="cafe_name" required placeholder="Luna Cafe"/></div><div className="field"><label>Café phone number</label><input name="cafe_phone" required placeholder="+964 750 000 0000"/></div><div className="field"><label>City</label><input name="city" defaultValue="Erbil" required/></div><div className="field"><label>Café address</label><input name="address" required placeholder="Main street, near..."/></div><div className="full actions"><button disabled={loading} className="btn">{loading?'Creating...':'Create café account'}</button><button type="button" onClick={google} className="btn secondary">Continue with Google</button></div></form>}{tab==='signin'&&<form onSubmit={signIn} className="form-grid"><div className="field full"><label>Email address</label><input name="email" required type="email" placeholder="owner@cafe.com"/></div><div className="field full"><label>Password</label><input name="password" required type="password" placeholder="Your password"/></div><div className="full actions"><button disabled={loading} className="btn">Sign in</button><button type="button" className="btn secondary" onClick={google}><Mail size={16}/> Google</button><button type="button" className="btn secondary" onClick={forgot}>Forgot password?</button></div></form>}{tab==='staff'&&<form onSubmit={(e)=>{e.preventDefault(); setMessage('Staff phone/password login screen is ready. Connect the secure staff auth function before production use.')}} className="form-grid"><div className="field full"><label>Phone number</label><input name="phone" required placeholder="+964 750 000 0000"/></div><div className="field full"><label>Password</label><input name="password" required type="password" placeholder="Staff password"/></div><div className="full"><button className="btn"><Phone size={16}/> Staff sign in</button><p className="hint">For production, use Supabase phone OTP or a server-side hashed staff-auth function with rate limiting.</p></div></form>}</div></section></main>
}

'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
export default function ResetPassword(){
 const [msg,setMsg]=useState(''); const supabase=createClient();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault(); const fd=new FormData(e.currentTarget); const {error}=await supabase.auth.updateUser({password:String(fd.get('password'))}); setMsg(error?error.message:'Password updated. You can sign in now.');}
 return <main className="auth-main" style={{minHeight:'100vh'}}><form onSubmit={submit} className="auth-card"><h1>Set new password</h1>{msg&&<p>{msg}</p>}<div className="field"><label>New password</label><input name="password" type="password" minLength={8} required/></div><br/><button className="btn">Update password</button></form></main>
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const supabase = createClient();
  const router = useRouter();
  const [alert, setAlert] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') || '');
    const confirm = String(fd.get('confirm') || '');
    if (password.length < 8) {
      setAlert({ kind: 'error', text: 'Password must be at least 8 characters.' });
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setAlert({ kind: 'error', text: 'Passwords do not match.' });
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setAlert({ kind: 'error', text: error.message });
      setLoading(false);
      return;
    }
    setAlert({ kind: 'success', text: 'Password updated. Redirecting…' });
    setTimeout(() => router.push('/dashboard'), 1200);
  }

  return (
    <main className="auth-main" style={{ minHeight: '100vh' }}>
      <form onSubmit={submit} className="auth-card" noValidate>
        <Link className="pill" href="/"><ArrowLeft size={13} /> Back to website</Link>
        <h1>Set a new password</h1>
        <p className="hint">Enter a strong password you'll remember.</p>
        {alert && (
          <div className={`alert ${alert.kind === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 16 }}>
            {alert.text}
          </div>
        )}
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field full">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="field full">
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="full">
            <button className="btn" disabled={loading} type="submit">
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

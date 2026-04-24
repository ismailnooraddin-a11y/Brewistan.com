"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { ArrowLeft, Coffee, Eye, EyeOff } from 'lucide-react';
import { signUpSchema, signInSchema } from '@/lib/schemas';
import { slugify } from '@/lib/utils';

type Tab = 'create' | 'signin';

export default function GetStartedContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const [tab, setTab] = useState<Tab>('create');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  async function createCafe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    setFieldErrors({});

    const formEl = e.currentTarget;
    const fd = new FormData(formEl);

    const raw = {
      full_name: String(fd.get('full_name') || ''),
      owner_phone: String(fd.get('owner_phone') || ''),
      email: String(fd.get('email') || ''),
      password: String(fd.get('password') || ''),
      cafe_name: String(fd.get('cafe_name') || ''),
      slug: String(fd.get('slug') || slugify(String(fd.get('cafe_name') || ''))),
      cafe_phone: String(fd.get('cafe_phone') || ''),
      city: String(fd.get('city') || 'Erbil'),
      address: String(fd.get('address') || ''),
    };

    const parsed = signUpSchema.safeParse(raw);

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setFieldErrors(errs);
      setLoading(false);
      return;
    }

    const data = parsed.data;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent('/dashboard')}`,
        data: {
          full_name: data.full_name,
          phone: data.owner_phone,
          role: 'cafe_owner',
        },
      },
    });

    if (signUpError) {
      setAlert({ kind: 'error', text: signUpError.message });
      setLoading(false);
      return;
    }

    if (signUpData.session) {
      const { error: rpcError } = await supabase.rpc('create_cafe', {
        p_cafe_name: data.cafe_name,
        p_slug: data.slug,
        p_contact_email: data.email,
        p_contact_phone: data.cafe_phone,
        p_city: data.city,
        p_address: data.address,
      });

      if (rpcError) {
        setAlert({
          kind: 'error',
          text: `Café setup failed: ${rpcError.message}. You can retry from the dashboard.`,
        });
        setLoading(false);
        router.push('/dashboard');
        return;
      }

      router.push('/dashboard');
      return;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'pending_cafe',
        JSON.stringify({
          cafe_name: data.cafe_name,
          slug: data.slug,
          contact_email: data.email,
          contact_phone: data.cafe_phone,
          city: data.city,
          address: data.address,
        })
      );
    }

    setAlert({
      kind: 'success',
      text: 'Account created. Check your email to confirm, then return here to finish setup.',
    });

    setLoading(false);
  }

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);

    const parsed = signInSchema.safeParse({
      email: String(fd.get('email') || ''),
      password: String(fd.get('password') || ''),
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setFieldErrors(errs);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      setAlert({ kind: 'error', text: error.message });
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  async function forgot() {
    const email = prompt('Enter your email address to receive a password reset link:');
    if (!email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    setAlert(
      error
        ? { kind: 'error', text: error.message }
        : { kind: 'success', text: 'Password reset link sent. Check your email.' }
    );
  }

  return (
    <main className="auth-layout">
      <aside className="auth-side">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href="/" className="brand" style={{ color: '#fffdf8' }}>
            <span className="brand-mark">B</span>
            Brewistan
          </Link>

          <h1 style={{ marginTop: 28 }}>Open your café loyalty system today.</h1>

          <p style={{ marginTop: 12, maxWidth: 360 }}>
            Create your café profile, design a card that matches your brand, launch your first
            campaign — all from one refined dashboard.
          </p>
        </div>

        <div
          className="panel"
          style={{
            background: 'rgba(255, 253, 248, 0.06)',
            borderColor: 'rgba(255, 253, 248, 0.12)',
            boxShadow: 'none',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            className="icon-box"
            style={{
              background: 'rgba(200, 155, 69, 0.16)',
              color: 'var(--gold-soft)',
            }}
          >
            <Coffee />
          </div>

          <h3 style={{ color: '#fffdf8' }}>Set up in under 5 minutes</h3>

          <p style={{ color: 'rgba(255, 253, 248, 0.68)' }}>
            No app store. No wallet dependency. No paper cards.
          </p>
        </div>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <Link className="pill" href="/">
            <ArrowLeft size={13} /> Back to website
          </Link>

          <h1>Get started with Brewistan</h1>

          <p className="hint">Create a café account, or sign in to continue.</p>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'create'}
              className={`tab ${tab === 'create' ? 'active' : ''}`}
              onClick={() => setTab('create')}
            >
              Create café
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signin'}
              className={`tab ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => setTab('signin')}
            >
              Sign in
            </button>

            <button type="button" role="tab" className="tab" onClick={google}>
              Continue with Google
            </button>
          </div>

          {alert && (
            <div className={`alert ${alert.kind === 'error' ? 'alert-error' : 'alert-success'}`}>
              {alert.text}
            </div>
          )}

          {tab === 'create' && (
            <form onSubmit={createCafe} className="form-grid" noValidate>
              <div className="field">
                <label htmlFor="full_name">Owner full name</label>
                <input
                  id="full_name"
                  name="full_name"
                  required
                  placeholder="Ismail Noor"
                  autoComplete="name"
                />
                {fieldErrors.full_name && <span className="error">{fieldErrors.full_name}</span>}
              </div>

              <div className="field">
                <label htmlFor="owner_phone">Owner phone</label>
                <input
                  id="owner_phone"
                  name="owner_phone"
                  required
                  placeholder="+964 750 000 0000"
                  autoComplete="tel"
                />
                {fieldErrors.owner_phone && (
                  <span className="error">{fieldErrors.owner_phone}</span>
                )}
              </div>

              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  required
                  type="email"
                  placeholder="owner@cafe.com"
                  autoComplete="email"
                />
                {fieldErrors.email && <span className="error">{fieldErrors.email}</span>}
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>

                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    name="password"
                    required
                    minLength={8}
                    type={show ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    style={{ width: '100%' }}
                  />

                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                    }}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {fieldErrors.password && <span className="error">{fieldErrors.password}</span>}
              </div>

              <div className="field">
                <label htmlFor="cafe_name">Café name</label>
                <input id="cafe_name" name="cafe_name" required placeholder="Luna Café" />
                {fieldErrors.cafe_name && <span className="error">{fieldErrors.cafe_name}</span>}
              </div>

              <div className="field">
                <label htmlFor="slug">Café URL slug</label>
                <input
                  id="slug"
                  name="slug"
                  required
                  placeholder="luna-cafe"
                  pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                />

                <span className="hint">
                  Your QR will open brewistan.com/c/<em>slug</em>
                </span>

                {fieldErrors.slug && <span className="error">{fieldErrors.slug}</span>}
              </div>

              <div className="field">
                <label htmlFor="cafe_phone">Café phone</label>
                <input
                  id="cafe_phone"
                  name="cafe_phone"
                  required
                  placeholder="+964 750 000 0000"
                />
                {fieldErrors.cafe_phone && (
                  <span className="error">{fieldErrors.cafe_phone}</span>
                )}
              </div>

              <div className="field">
                <label htmlFor="city">City</label>
                <input id="city" name="city" defaultValue="Erbil" required />
                {fieldErrors.city && <span className="error">{fieldErrors.city}</span>}
              </div>

              <div className="field full">
                <label htmlFor="address">Café address</label>
                <input id="address" name="address" required placeholder="Street, area, city" />
                {fieldErrors.address && <span className="error">{fieldErrors.address}</span>}
              </div>

              <div className="full actions" style={{ marginTop: 6 }}>
                <button disabled={loading} className="btn" type="submit">
                  {loading ? 'Creating…' : 'Create café account'}
                </button>
              </div>
            </form>
          )}

          {tab === 'signin' && (
            <form onSubmit={signIn} className="form-grid" noValidate>
              <div className="field full">
                <label htmlFor="si-email">Email address</label>
                <input id="si-email" name="email" required type="email" autoComplete="email" />
                {fieldErrors.email && <span className="error">{fieldErrors.email}</span>}
              </div>

              <div className="field full">
                <label htmlFor="si-password">Password</label>
                <input
                  id="si-password"
                  name="password"
                  required
                  type="password"
                  autoComplete="current-password"
                />
                {fieldErrors.password && <span className="error">{fieldErrors.password}</span>}
              </div>

              <div className="full actions" style={{ marginTop: 6 }}>
                <button disabled={loading} className="btn" type="submit">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <button type="button" className="btn btn-ghost" onClick={forgot}>
                  Forgot password?
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

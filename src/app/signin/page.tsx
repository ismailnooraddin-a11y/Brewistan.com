"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";

export default function SigninPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container-pad py-14 sm:py-24">
        <div className="mx-auto max-w-md">
          <div className="animate-fade-up text-center">
            <span className="eyebrow justify-center">Welcome back</span>
            <h1 className="mt-5 text-display text-ink">
              Good to see you{" "}
              <span className="display-serif text-ember">again.</span>
            </h1>
            <p className="mt-4 text-[15px] text-ink-soft">
              Sign in to open your dashboard.
            </p>
          </div>

          <div className="card mt-10 animate-scale-in">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="you@yourcafe.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  placeholder="Your password"
                />
              </div>

              {error && (
                <div className="animate-fade-in rounded-xl border border-ember/30 bg-ember/5 px-4 py-3 text-[13px] text-ember-deep">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? (
                  <>
                    <Spinner /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <span className="btn-arrow" aria-hidden>
                      →
                    </span>
                  </>
                )}
              </button>

              <p className="text-center text-[13px] text-ink-muted">
                New to Brewistan?{" "}
                <Link href="/signup" className="link-underline text-ink">
                  Create a café account
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12 a10 10 0 0 0 -10 -10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

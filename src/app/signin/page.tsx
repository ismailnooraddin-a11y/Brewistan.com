"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

export default function SigninPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <div className="container-pad flex items-start justify-center pb-16 pt-12 sm:pt-20">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-display text-ink">Welcome back</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              Sign in to manage your café.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="you@cafe.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="field-label mb-0">
                  Password
                </label>
                <Link
                  href="/signin"
                  className="text-[12px] text-ink-muted underline decoration-line underline-offset-4 hover:text-ink-soft"
                >
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-paper-tint px-3 py-2 text-[13px] text-ink-soft">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <p className="pt-1 text-center text-[13px] text-ink-muted">
              New to Brewistan?{" "}
              <Link href="/signup" className="link">
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cafeName, setCafeName] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        data: {
          full_name: fullName,
          phone,
          cafe_name: cafeName,
          city,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setSent(true);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-paper">
        <Header />
        <div className="container-pad flex items-start justify-center pt-16 sm:pt-24">
          <div className="w-full max-w-md">
            <div className="card text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper-tint">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="text-ink"
                >
                  <path d="M3 8l9 6 9-6M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
                </svg>
              </div>
              <h1 className="text-h2 text-ink">Check your email</h1>
              <p className="mt-3 text-[15px] leading-[1.55] text-ink-soft">
                We sent a confirmation link to{" "}
                <span className="font-medium text-ink">{email}</span>. Click the
                link to finish creating your account.
              </p>
              <p className="mt-6 text-[13px] text-ink-muted">
                Wrong email?{" "}
                <button
                  onClick={() => setSent(false)}
                  className="link"
                  type="button"
                >
                  Start over
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <div className="container-pad flex items-start justify-center pb-16 pt-10 sm:pt-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-display text-ink">Create your café</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              Start your loyalty program in under a minute.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label htmlFor="fullName" className="field-label">
                Your name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field-input"
                placeholder="Ahmed Hassan"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="cafeName" className="field-label">
                Café name
              </label>
              <input
                id="cafeName"
                type="text"
                required
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                className="field-input"
                placeholder="Coffee Corner"
                autoComplete="organization"
              />
            </div>

            <div>
              <label htmlFor="city" className="field-label">
                City
              </label>
              <input
                id="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="field-input"
                placeholder="Erbil"
                autoComplete="address-level2"
              />
            </div>

            <div>
              <label htmlFor="phone" className="field-label">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="field-input"
                placeholder="+964 770 123 4567"
                autoComplete="tel"
              />
            </div>

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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="At least 8 characters"
                autoComplete="new-password"
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
              {loading ? "Creating your account…" : "Create account"}
            </button>

            <p className="pt-1 text-center text-[13px] text-ink-muted">
              Already have an account?{" "}
              <Link href="/signin" className="link">
                Sign in
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-[12px] text-ink-muted">
            By creating an account you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

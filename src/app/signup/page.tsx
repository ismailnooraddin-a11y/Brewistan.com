"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [cafeName, setCafeName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          cafe_name: cafeName,
          city,
          phone,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container-pad py-14 sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-12 md:grid-cols-[1fr_1.1fr]">
          {/* Left — brand copy */}
          <div className="animate-fade-up">
            <span className="eyebrow">Open an account</span>
            <h1 className="mt-5 text-display text-ink">
              Your café,{" "}
              <span className="display-serif text-ember">
                poured in.
              </span>
            </h1>
            <p className="mt-5 max-w-sm text-[16px] leading-[1.65] text-ink-soft">
              Tell us a little about your shop. You&rsquo;ll be up and
              stamping before your espresso cools.
            </p>

            <ul className="mt-10 space-y-4">
              {[
                "No credit card required",
                "Free while you try it",
                "Cancel anytime — it's a few clicks",
              ].map((t, i) => (
                <li
                  key={t}
                  className="stagger-child flex items-center gap-3 text-[14px] text-ink-soft"
                  style={{ animationDelay: `${120 + i * 80}ms` }}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ember/15 text-ember">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12 l4 4 l10 -10" />
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — form */}
          <div className="card animate-scale-in">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="field-label">
                    Your name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="field-input"
                    placeholder="Dilan Ahmed"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="field-label">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="field-input"
                    placeholder="+964 ..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                    placeholder="Mazîn Coffee"
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
                  />
                </div>
              </div>

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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  placeholder="At least 8 characters"
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
                    <Spinner /> Creating account…
                  </>
                ) : (
                  <>
                    Create café account
                    <span className="btn-arrow" aria-hidden>
                      →
                    </span>
                  </>
                )}
              </button>

              <p className="text-center text-[13px] text-ink-muted">
                Already have one?{" "}
                <Link href="/signin" className="link-underline text-ink">
                  Sign in
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

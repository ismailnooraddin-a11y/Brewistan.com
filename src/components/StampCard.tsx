"use client";

import { useEffect, useState } from "react";

export default function StampCard() {
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setFilled(7);
      return;
    }
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (n > 7) {
        // reset back to 0 with a little pause
        setTimeout(() => setFilled(0), 1800);
        n = 0;
        return;
      }
      setFilled(n);
    }, 520);
    return () => clearInterval(id);
  }, []);

  const slots = Array.from({ length: 8 });

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Back card for depth */}
      <div
        aria-hidden
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border border-line bg-paper-tint shadow-soft"
      />
      {/* Main stamp card */}
      <div className="relative rounded-3xl border border-line bg-paper-card p-7 shadow-lift">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Loyalty card
            </p>
            <p className="mt-1 display-serif text-[22px] leading-none text-ink">
              Mazîn Coffee
            </p>
          </div>
          <div className="relative h-12 w-12">
            {/* Cup */}
            <svg viewBox="0 0 48 48" className="h-full w-full">
              <path
                d="M10 18 h24 v14 a6 6 0 0 1 -6 6 h-12 a6 6 0 0 1 -6 -6 z"
                fill="none"
                stroke="#1A1410"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M34 22 h3 a3 3 0 0 1 0 6 h-3"
                fill="none"
                stroke="#1A1410"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            {/* Steam lines */}
            <span
              className="absolute left-[14px] top-0 h-3 w-[1.5px] rounded-full bg-ember/80 animate-steam"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="absolute left-[22px] top-[-2px] h-4 w-[1.5px] rounded-full bg-ember/80 animate-steam"
              style={{ animationDelay: "0.5s" }}
            />
            <span
              className="absolute left-[30px] top-0 h-3 w-[1.5px] rounded-full bg-ember/80 animate-steam"
              style={{ animationDelay: "1s" }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="my-6 h-px bg-line" />

        {/* Stamp grid */}
        <p className="mb-3 text-[12px] text-ink-muted">
          Buy 8, get 1 free
        </p>
        <div className="grid grid-cols-4 gap-3">
          {slots.map((_, i) => {
            const isFilled = i < filled;
            return (
              <div
                key={i}
                className={`stamp-dot transition-all duration-300 ease-enter ${
                  isFilled ? "filled scale-100" : "scale-95"
                }`}
                style={{
                  transitionDelay: isFilled ? `${i * 40}ms` : "0ms",
                }}
              >
                {isFilled ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path
                      d="M5 12 l4 4 l10 -10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-[11px]">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer row */}
        <div className="mt-6 flex items-center justify-between rounded-xl bg-paper-tint px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Next reward
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-ink">
              Free cappuccino
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Progress
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-ember">
              {filled} / 8
            </p>
          </div>
        </div>
      </div>

      {/* Floating ember accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-ember/20 blur-2xl"
      />
    </div>
  );
}

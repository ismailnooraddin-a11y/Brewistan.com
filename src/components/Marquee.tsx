"use client";

const CAFES = [
  "Mazîn Coffee",
  "Hawraman Roasters",
  "Cardamom & Co.",
  "Slow Press",
  "Sulî Espresso Bar",
  "The Kettle House",
  "Duhok Drip",
  "Zîn Café",
  "Kahwa & Kitap",
  "Third Hill Beans",
];

export default function Marquee() {
  // Double the list so the CSS loop is seamless
  const items = [...CAFES, ...CAFES];
  return (
    <div className="relative overflow-hidden border-y border-line bg-paper-card/60 py-6">
      {/* Fade edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-paper to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-paper to-transparent"
      />

      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
        {items.map((name, i) => (
          <span
            key={i}
            className="display-serif text-[22px] text-ink-soft"
          >
            {name}
            <span className="ml-12 text-ember">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

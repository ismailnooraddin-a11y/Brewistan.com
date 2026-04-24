export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Coffee bean — two halves */}
      <ellipse
        cx="16"
        cy="16"
        rx="10"
        ry="13"
        fill="#1A1410"
        transform="rotate(-18 16 16)"
      />
      <path
        d="M16 5 Q 13 16 16 27"
        stroke="#F3C48A"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        transform="rotate(-18 16 16)"
      />
      {/* Steam dot */}
      <circle cx="24" cy="6" r="1.6" fill="#B8532C" />
    </svg>
  );
}

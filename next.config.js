/** @type {import('next').NextConfig} */

// ─── Content Security Policy ───────────────────────────────────────────
// Tightened to allow only what Brewistan actually needs:
//   • Same-origin scripts/styles
//   • Supabase HTTPS REST + WebSocket endpoints (Realtime needs wss://)
//   • Supabase storage for café logos
//   • Inline styles allowed (Next.js + lucide-react inject runtime styles)
//   • Inline scripts allowed (Next.js needs them for hydration)
// Tighten further with nonces in a future phase if desired.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '');

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://${supabaseHost} https://*.supabase.co`,
  `font-src 'self' data:`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.supabase.co wss://*.supabase.co`,
  `frame-src 'none'`,
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;

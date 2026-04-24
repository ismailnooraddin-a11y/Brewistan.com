import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Brewistan — Café Loyalty, Reimagined',
    template: '%s · Brewistan',
  },
  description: 'A premium web-based loyalty platform for modern cafés in Iraq. Replace paper punch cards with branded digital cards — no app install required.',
  keywords: ['café loyalty', 'loyalty program', 'Iraq', 'Erbil', 'stamp card', 'QR loyalty'],
  authors: [{ name: 'Brewistan' }],
  openGraph: {
    title: 'Brewistan — Café Loyalty, Reimagined',
    description: 'Branded digital loyalty cards for cafés. No app install.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#14251d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}


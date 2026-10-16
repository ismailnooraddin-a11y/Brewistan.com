import type { Metadata, Viewport } from 'next';
import './globals.css';
import { dirFor } from '@/lib/i18n';
import { getLocale } from '@/lib/server-context';

export const metadata: Metadata = {
  title: { default: 'Brewistan', template: '%s · Brewistan' },
  description: 'Digital loyalty for luxury cafes in Iraq.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#151311' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale === 'ckb' ? 'ckb' : locale} dir={dirFor(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Kufi+Arabic:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

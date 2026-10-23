import type { Metadata, Viewport } from 'next';
import { CustomerProvider } from '@/components/customer/CustomerProvider';

export const metadata: Metadata = {
  title: 'Brewistan',
  description: 'Your café loyalty cards in one place.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Brewistan', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#121110' };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#121110] text-[#f3eee6] antialiased">
      <style>{'body{background:#121110}'}</style>
      <CustomerProvider>{children}</CustomerProvider>
    </div>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brewistan | Café Loyalty Platform',
  description: 'A premium web-based loyalty platform for modern cafés in Iraq.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

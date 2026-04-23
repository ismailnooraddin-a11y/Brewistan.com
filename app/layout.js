import './globals.css';

export const metadata = {
  title: 'Brewistan',
  description: 'Web-first loyalty platform for modern cafés in Iraq.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

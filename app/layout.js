import './globals.css';

export const metadata = {
  title: 'Brewistan',
  description: 'Elegant web-based café loyalty platform for modern coffee brands.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

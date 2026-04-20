import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brewistan — Loyalty made simple for coffee shops",
  description:
    "Digital stamp cards for independent cafés. Reward loyal customers without the plastic.",
  metadataBase: new URL("https://brewistan.com"),
  openGraph: {
    title: "Brewistan",
    description: "Digital loyalty for coffee shops.",
    url: "https://brewistan.com",
    siteName: "Brewistan",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

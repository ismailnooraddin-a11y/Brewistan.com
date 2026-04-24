import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Brewistan — Loyalty, poured slowly",
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}

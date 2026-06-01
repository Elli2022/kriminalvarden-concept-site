import type { Metadata } from "next";
import { Bitter, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const bitter = Bitter({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kriminalvården planeringsyta",
  description:
    "Planeringsyta för personal med konfliktspärrar, klientstatus och framtida integrationsyta för klientpaddor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${publicSans.variable} ${bitter.variable}`}>
      <body>{children}</body>
    </html>
  );
}

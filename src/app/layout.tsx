import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}

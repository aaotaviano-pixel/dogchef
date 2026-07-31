import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Dog do Chef — prensado de verdade",
  description: "Hot dogs prensados, gratinados, porções e bebidas preparados na hora.",
  applicationName: "Dog do Chef",
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#f6faf6", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// The brand face (DESIGN.md: one family at every level). Self-hosted by
// next/font, so the CSP's font-src 'self' still holds.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Voluntree Admin",
  description:
    "Administrative console for verifying NGOs, handling safety reports, and moderating Voluntree drives, people and payments.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#012d1d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

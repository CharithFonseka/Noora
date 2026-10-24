import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOORA — A softer kind of everyday",
  description: "Thoughtful, wearable clothing for women, men and children. Discover NOORA online in Sri Lanka.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><SiteHeader />{children}</body>
    </html>
  );
}


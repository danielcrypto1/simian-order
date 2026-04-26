import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMIAN ORDER",
  description: "An NFT collective on ApeChain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen scanline">{children}</body>
    </html>
  );
}

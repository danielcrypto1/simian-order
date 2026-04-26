import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMIAN ORDER",
  description: "An NFT collective on ApeChain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen scanline">
        {children}
        {/* Vercel Web Analytics — pageviews are tracked automatically.
            Custom events go through track() in lib/analytics.ts. */}
        <Analytics />
      </body>
    </html>
  );
}

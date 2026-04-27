import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import InteractionLayer from "@/components/InteractionLayer";
import NetworkStatus from "@/components/NetworkStatus";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMIAN ORDER",
  description: "An NFT collective on ApeChain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen scanline">
        {/* Faint pixel watermark in the corner — looks like a system prompt. */}
        <div
          aria-hidden
          className="pointer-events-none fixed left-2 bottom-1 text-mute pixel text-xs select-none"
          style={{ opacity: 0.35, letterSpacing: "0.1em" }}
        >
          /SIMIAN_ORDER &mdash; ape.chain &mdash; mmxxvi
        </div>

        {children}

        {/* Global subtle interaction layer — cursor halo, click flash,
            rare-glitch event, scroll parallax CSS var, first-load splash,
            night-mode toggle, "alignment detected" + "observed" overlays. */}
        <InteractionLayer />

        {/* Cosmetic telemetry block (network/latency/nodes). */}
        <NetworkStatus />

        {/* Vercel Web Analytics — pageviews are tracked automatically.
            Custom events go through track() in lib/analytics.ts. */}
        <Analytics />
      </body>
    </html>
  );
}

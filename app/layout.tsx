import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import InteractionLayer from "@/components/InteractionLayer";
import NetworkStatus from "@/components/NetworkStatus";
import VoidResidue from "@/components/VoidResidue";
import AmbientAudio from "@/components/AmbientAudio";
import StoreHydration from "@/components/StoreHydration";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMIAN ORDER",
  description: "An NFT collective on ApeChain.",
  // Favicon — small.png lives at /public/small.png. The same asset is
  // used for the standard tab icon AND the iOS / Android home-screen
  // icon so no resizing is needed beyond what the browser does itself.
  icons: {
    icon: "/small.png",
    shortcut: "/small.png",
    apple: "/small.png",
  },
  // Mobile-first viewport: include initialScale=1 so the browser
  // doesn't apply its old "zoom out a desktop layout" heuristic.
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  },
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

        {/* Triggers Zustand persist rehydration after the first client
            render so SSR/CSR initial trees match (no React #418/#423/#425). */}
        <StoreHydration />

        {/* Global subtle interaction layer — cursor halo, click flash,
            rare-glitch event, scroll parallax CSS var, first-load splash,
            night-mode toggle, "alignment detected" + "observed" overlays. */}
        <InteractionLayer />

        {/* Cosmetic telemetry block (network/latency/nodes). */}
        <NetworkStatus />

        {/* Post-/void/deep residue — corner hint + rare image flashes
            + body.void-seen marker. Renders nothing for visitors who
            haven't been deeper. */}
        <VoidResidue />

        {/* Site-wide ambient audio. Loads /audio/simian.mp3, plays
            on first gesture, mutes on /void/deep, toggle in top-right
            corner. No-ops gracefully if the MP3 file is missing. */}
        <AmbientAudio />

        {/* Vercel Web Analytics — pageviews are tracked automatically.
            Custom events go through track() in lib/analytics.ts. */}
        <Analytics />
      </body>
    </html>
  );
}

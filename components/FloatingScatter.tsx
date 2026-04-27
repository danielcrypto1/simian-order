"use client";

import { SOCIAL } from "@/lib/links";
import OpenseaLink from "./OpenseaLink";

/**
 * Floating scatter — replaces the old right-side dashboard column.
 *
 * On lg+ screens these elements are absolutely positioned along the right
 * edge of the viewport at varying y-offsets and tilts so they feel like
 * stickers / scraps stuck on the page rather than cards in a column.
 *
 * On smaller screens they collapse into an inline scatter section that
 * appears below the main content (the parent layout puts this BELOW
 * children on mobile).
 *
 * Uses pointer-events:none on the absolute container, then re-enables
 * pointer-events on each child, so the floats never block interaction
 * with the underlying content area.
 */
export default function FloatingScatter() {
  return (
    <>
      {/* DESKTOP — absolute floats on the right edge */}
      <div
        aria-hidden={false}
        className="hidden lg:block fixed top-[140px] right-3 w-[180px] z-10 pointer-events-none"
      >
        {/* Notice — tilted post-it */}
        <div
          className="relative pl-3 pr-2 py-2 border border-bleed bg-black/85 pointer-events-auto"
          style={{ transform: "rotate(2deg)" }}
        >
          <div className="absolute -top-2 left-2 sticker">notice</div>
          <p className="font-serif italic text-xs text-ape-200 leading-snug pt-2">
            the order is silent. the simians are watching.
          </p>
        </div>

        {/* Hand-scrawled "elsewhere" cluster */}
        <div
          className="mt-8 pointer-events-auto"
          style={{ transform: "rotate(-1.4deg)" }}
        >
          <div className="font-mono uppercase tracking-widest2 text-mute mb-1 text-xxxs">
            ── elsewhere ──
          </div>
          <ul className="space-y-[2px] font-mono text-xxs">
            <li><a href={SOCIAL.X} target="_blank" rel="noreferrer" className="nav-link">x ↗</a></li>
            <li><a href={SOCIAL.DISCORD} target="_blank" rel="noreferrer" className="nav-link">discord ↗</a></li>
            <li><OpenseaLink source="scatter-desktop" className="nav-link">opensea ↗</OpenseaLink></li>
          </ul>
        </div>

        {/* Hidden door — looks like a system marker */}
        <div
          className="mt-8 pointer-events-auto"
          style={{ transform: "rotate(0.8deg)" }}
        >
          <div className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-1">
            // file: door.txt
          </div>
          <p className="font-serif italic text-xs text-mute leading-snug">
            sit quietly. the simians may notice you.
          </p>
        </div>
      </div>

      {/* MOBILE — same content but inline, stacked below content */}
      <div className="lg:hidden mt-12 space-y-6">
        <div
          className="relative pl-3 pr-2 py-2 border border-bleed bg-black/85 inline-block"
          style={{ transform: "rotate(-1deg)" }}
        >
          <div className="absolute -top-2 left-2 sticker">notice</div>
          <p className="font-serif italic text-xs text-ape-200 leading-snug pt-2 max-w-[280px]">
            the order is silent. the simians are watching.
          </p>
        </div>

        <div className="tilt-r">
          <div className="font-mono uppercase tracking-widest2 text-mute mb-1 text-xxxs">
            ── elsewhere ──
          </div>
          <ul className="space-y-[2px] font-mono text-xxs">
            <li><a href={SOCIAL.X} target="_blank" rel="noreferrer" className="nav-link">x ↗</a></li>
            <li><a href={SOCIAL.DISCORD} target="_blank" rel="noreferrer" className="nav-link">discord ↗</a></li>
            <li><OpenseaLink source="scatter-mobile" className="nav-link">opensea ↗</OpenseaLink></li>
          </ul>
        </div>
      </div>
    </>
  );
}

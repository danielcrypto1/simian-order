"use client";

import Image from "next/image";

/**
 * Layered chaos background system.
 *
 *   Layer 0 (optional): Background.png  — full-bleed photo, blurred + dimmed
 *   Layer 1: chaos SVG (bg/01 or bg/02) — painted gradient + ghost simians
 *   Layer 2: drifting fractal-noise grain  — adds movement
 *   Layer 3: glitch overlay — Glitch.png OR procedural SVG bars/streaks
 *
 * The component is fixed-positioned and pointer-events:none, so it never
 * blocks clicks. z-index is negative so it sits behind everything.
 *
 * Usage:
 *   <MediaBackground />                           // default: photo + SVG + bars
 *   <MediaBackground photo={false} />             // no photo, only SVG layers
 *   <MediaBackground variant={2} overlay="streaks" />  // alt SVG + alt overlay
 *   <MediaBackground glitchPng overlay="none" />  // photo + glitch PNG, no bars
 */

type Variant = 1 | 2;
type Overlay = "bars" | "streaks" | "none";

type Props = {
  /** include the heavy photo backdrop. defaults to true. */
  photo?: boolean;
  /** which procedural SVG chaos field to render on top of the photo. */
  variant?: Variant;
  /** glitch overlay flavour. */
  overlay?: Overlay;
  /** additionally render the Glitch.png at low opacity over everything. */
  glitchPng?: boolean;
  /** override the SVG-bg opacity (0..1). default 0.45. */
  opacity?: number;
  /** override the SVG-bg blur in px. default 6. */
  blur?: number;
};

export default function MediaBackground({
  photo = true,
  variant = 1,
  overlay = "bars",
  glitchPng = false,
  opacity = 0.45,
  blur = 6,
}: Props) {
  const bgSrc = `/bg/0${variant}.svg`;
  const overlaySrc =
    overlay === "none" ? null : `/overlays/${overlay}.svg`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* LAYER 0 — photo backdrop (Background.png), pan-animated +
          parallax. The outer wrapper translates with --scroll-y so the
          background drifts at ~12% of foreground scroll, giving a sense
          of depth without dropping below the fold. */}
      {photo && (
        <div
          className="absolute inset-0"
          style={{
            // Scale a bit larger so the parallax translate never reveals
            // the page background underneath as the user scrolls.
            transform:
              "translate3d(0, calc(var(--scroll-y, 0px) * -0.12), 0) scale(1.06)",
            willChange: "transform",
          }}
        >
          <Image
            src="/media/background.png"
            alt=""
            fill
            priority
            sizes="100vw"
            quality={70}
            className="object-cover bg-photo--pan"
            style={{
              filter: "blur(3px) brightness(0.55) saturate(1.1)",
            }}
          />
        </div>
      )}

      {/* LAYER 1 — chaos SVG (gradient bloom + ghost shapes) */}
      <img
        src={bgSrc}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity, filter: `blur(${blur}px)` }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />

      {/* LAYER 2 — drifting noise (movement) */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          opacity: 0.20,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>\")",
          animation: "drift 14s ease-in-out infinite",
        }}
      />

      {/* LAYER 3a — procedural glitch overlay (bars / streaks SVG).
          SVG is tiny so eager is fine. */}
      {overlaySrc && (
        <img
          src={overlaySrc}
          alt=""
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen"
          style={{ opacity: overlay === "streaks" ? 0.30 : 0.22 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {/* LAYER 3b — real Glitch.png at very low opacity. Lazy-loaded
          because the SVG bars layer below already covers most of the
          glitch atmosphere; this is decorative reinforcement. */}
      {glitchPng && (
        <img
          src="/media/glitch.png"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen"
          style={{ opacity: 0.10 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

"use client";

/**
 * Character placement system.
 *
 * Three rules from the design brief:
 *   1. NEVER inside a clean box.
 *   2. ALWAYS overflowing / cut off / partially behind text.
 *   3. Reuse the same 3-5 characters everywhere — no new ones.
 *
 * This component handles (1) and (2) via a Position preset that picks
 * sensible absolute coordinates + which edge gets cut off, and (3) is
 * enforced by capping `variant` to 1..5.
 *
 * The component is purely visual — it renders an absolutely-positioned
 * image with pointer-events:none. It must be placed inside a parent
 * with position:relative.
 */

type Position =
  | "left-edge"      // peeks in from off-screen left, cut at left
  | "right-edge"     // peeks in from off-screen right, cut at right
  | "top-right"      // half-visible top-right corner, cut at top+right
  | "bottom-left"    // crouched at bottom-left, cut at bottom+left
  | "behind-text"    // sits centered behind a text block at low opacity
  | "drift-back";    // far back, very low opacity, slow drift (atmosphere)

type Variant = 1 | 2 | 3 | 4 | 5;

/**
 * Variants 1-3 ship as procedural SVGs in /public/simians/.
 * Variants 4-5 are the real PNGs supplied by the user, mapped onto:
 *   4 → /media/character.png   (the main supplied character "1.png")
 *   5 → /media/void.png        (the void character)
 *
 * If a real /public/simians/0X.png exists with the same number it would
 * still resolve via the SVG path here — that's intentional: the variants
 * 4/5 ARE the PNGs. To override 1-3 with real artwork, drop a PNG with
 * the same number in /public/simians/ and change `srcFor()` below.
 */
function srcFor(variant: Variant): string {
  switch (variant) {
    case 4: return "/media/character.png";
    case 5: return "/media/void.png";
    default: return `/simians/0${variant}.svg`;
  }
}

type Props = {
  variant?: Variant;
  position?: Position;
  /** override the default opacity for this position (0..1) */
  opacity?: number;
  /** override the default blur in px */
  blur?: number;
  /** override the default rotation in degrees */
  rotate?: number;
  /** override the default size as a CSS width string ("320px", "32vw", etc) */
  size?: string;
  /** higher z-index puts the character above sibling content */
  z?: number;
  /** optional className passthrough for one-off tweaks */
  className?: string;
};

const PRESETS: Record<Position, {
  className: string;
  defaultOpacity: number;
  defaultBlur: number;
  defaultRotate: number;
  defaultSize: string;
  defaultZ: number;
}> = {
  "left-edge": {
    className: "absolute -left-[16%] top-1/3",
    defaultOpacity: 0.85,
    defaultBlur: 0,
    defaultRotate: -3,
    defaultSize: "30vw",
    defaultZ: 1,
  },
  "right-edge": {
    className: "absolute -right-[18%] top-1/4",
    defaultOpacity: 0.85,
    defaultBlur: 0,
    defaultRotate: 4,
    defaultSize: "32vw",
    defaultZ: 1,
  },
  "top-right": {
    className: "absolute -right-[8%] -top-[10%]",
    defaultOpacity: 0.55,
    defaultBlur: 1,
    defaultRotate: 6,
    defaultSize: "26vw",
    defaultZ: 0,
  },
  "bottom-left": {
    className: "absolute -left-[6%] -bottom-[12%]",
    defaultOpacity: 0.65,
    defaultBlur: 0,
    defaultRotate: -4,
    defaultSize: "28vw",
    defaultZ: 0,
  },
  "behind-text": {
    className: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
    defaultOpacity: 0.18,
    defaultBlur: 4,
    defaultRotate: 0,
    defaultSize: "60vw",
    defaultZ: 0,
  },
  "drift-back": {
    className: "absolute right-[20%] top-[28%] drift",
    defaultOpacity: 0.10,
    defaultBlur: 6,
    defaultRotate: 2,
    defaultSize: "22vw",
    defaultZ: 0,
  },
};

export default function SimianCharacter({
  variant = 1,
  position = "right-edge",
  opacity,
  blur,
  rotate,
  size,
  z,
  className = "",
}: Props) {
  const preset = PRESETS[position];
  const op = opacity ?? preset.defaultOpacity;
  const bl = blur    ?? preset.defaultBlur;
  const ro = rotate  ?? preset.defaultRotate;
  const sz = size    ?? preset.defaultSize;
  const zi = z       ?? preset.defaultZ;

  const src = srcFor(variant);

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      // Lazy-load + async-decode keeps the heavy character.png /
      // void.png off the critical path. The eager flag is opt-in via a
      // `behind-text` placement (which is the focal point on landing)
      // so foreground characters still load immediately.
      loading={position === "behind-text" ? "eager" : "lazy"}
      decoding="async"
      className={`${preset.className} pointer-events-none select-none ${className}`}
      style={{
        width: sz,
        height: "auto",
        opacity: op,
        filter:
          bl > 0
            ? `blur(${bl}px) drop-shadow(0 0 18px rgba(0,64,255,0.3))`
            : "drop-shadow(0 0 18px rgba(0,64,255,0.3))",
        transform: `rotate(${ro}deg)`,
        zIndex: zi,
      }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

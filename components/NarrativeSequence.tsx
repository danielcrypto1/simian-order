"use client";

import { useEffect, useState } from "react";

/**
 * Atmospheric narrative text on the landing page.
 *
 * Six short lines fade in / hold / fade out one at a time. Each line
 * has its own position + slight rotation so the eye drifts across the
 * page rather than reading a fixed column. All positions stay on the
 * right half of the viewport so the left-anchored entry CTA is never
 * blocked. On mobile we collapse to a centered bottom placement and
 * shorten the timing.
 *
 * Implementation is intentionally minimal:
 *   - one absolutely-positioned <span>
 *   - React `key` flip on each tick → element remounts → CSS keyframe
 *     restarts cleanly without state-machine bookkeeping
 *   - no rAF, no Math.random in render — one setInterval is the whole
 *     scheduling surface
 *   - the fade is a single keyframe (opacity + blur), composited by
 *     the browser, no JS-driven per-frame work
 *
 * Style hooks (`.narrative-line` + `narrative-fade` keyframe) live in
 * globals.css.
 */

const LINES: string[] = [
  "The Order was made for one purpose.",
  "To recognise those who stayed when everything said leave.",
  "No noise. No hand-holding. Just conviction.",
  "This isn’t for everyone — and it never was.",
  "Some will see it. Most won’t.",
];

/**
 * Per-line desktop positioning. Spec calls for "mostly centered, very
 * subtle offset shifts only, avoid extreme angles" — so every line is
 * anchored at viewport center via translate(-50%, -50%) and varies by
 * a few percent vertically or horizontally with rotations capped at
 * ±0.6°. The eye drifts gently rather than tracking across corners.
 */
type Pos = {
  /** vertical anchor as a percent of viewport height; default 50%. */
  topPct: number;
  /** horizontal anchor as a percent of viewport width; default 50%. */
  leftPct: number;
  /** rotation in degrees; spec: avoid extremes. */
  rotate: number;
};

const POSITIONS: Pos[] = [
  { topPct: 50, leftPct: 50, rotate: 0 },     // 1. dead center
  { topPct: 45, leftPct: 50, rotate: -0.4 },  // 2. slightly above
  { topPct: 55, leftPct: 50, rotate: 0.4 },   // 3. slightly below
  { topPct: 50, leftPct: 48, rotate: 0 },     // 4. nudge left
  { topPct: 48, leftPct: 52, rotate: 0.3 },   // 5. nudge up + right
];

// Slower, more cinematic pacing. Total cycle / line = ~5s desktop /
// ~4s mobile so the visible "hold" lands in the spec'd 3–4s window
// after the longer fade-in/out portions (see narrative-fade keyframe).
const TICK_MS_DESKTOP = 5000;
const TICK_MS_MOBILE = 4000;

export default function NarrativeSequence() {
  const [i, setI] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Track viewport size with matchMedia — cheap, no resize listener.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const ms = isMobile ? TICK_MS_MOBILE : TICK_MS_DESKTOP;
    const id = window.setInterval(() => {
      setI((n) => (n + 1) % LINES.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [isMobile]);

  const pos = POSITIONS[i];

  // Both desktop and mobile center via translate(-50%, -50%). Mobile
  // strips rotation entirely (per spec) and uses a fixed mid-bottom
  // anchor so it never clips off-screen with the larger type.
  const style: React.CSSProperties = isMobile
    ? {
        position: "absolute",
        top: "62%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(0deg)",
        textAlign: "center",
        whiteSpace: "normal",
        animationDuration: `${TICK_MS_MOBILE}ms`,
      }
    : {
        position: "absolute",
        top: `${pos.topPct}%`,
        left: `${pos.leftPct}%`,
        transform: `translate(-50%, -50%) rotate(${pos.rotate}deg)`,
        textAlign: "center",
        whiteSpace: "normal",
        animationDuration: `${TICK_MS_DESKTOP}ms`,
      };

  return (
    <span
      // Remounting on every tick lets the keyframe replay cleanly
      // without us having to manage in/out CSS classes by hand.
      key={i}
      className="narrative-line"
      aria-hidden
      style={style}
    >
      {LINES[i]}
    </span>
  );
}

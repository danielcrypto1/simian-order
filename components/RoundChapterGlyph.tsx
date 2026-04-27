"use client";

import { useRound } from "@/lib/useRound";

/**
 * Sideways pixel chapter marker rendered behind the dashboard content.
 * Shows the current round number as a roman numeral so it reads as a
 * book-chapter glyph rather than a digital readout. Updates whenever
 * admin changes the round.
 *
 * Hidden under lg breakpoint to keep mobile uncluttered.
 */
export default function RoundChapterGlyph() {
  const round = useRound();
  const numeral = toRoman(round ?? 1);
  return (
    <div
      aria-hidden
      className="hidden lg:block absolute left-2 top-12 font-pixel text-bleed pointer-events-none select-none"
      style={{
        opacity: 0.6,
        fontSize: "44px",
        transform: "rotate(-90deg)",
        transformOrigin: "left top",
      }}
    >
      {numeral}
    </div>
  );
}

/**
 * Tiny roman-numeral converter. Caps at MMM (3000) which is far above
 * any plausible round count; out-of-range or invalid input falls back
 * to "I" so the UI never shows nothing.
 */
function toRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "I";
  const v = Math.min(3999, Math.floor(n));
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let rest = v;
  for (const [val, sym] of map) {
    while (rest >= val) {
      out += sym;
      rest -= val;
    }
  }
  return out;
}

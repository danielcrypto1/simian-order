"use client";

import { useRound } from "@/lib/useRound";

/**
 * Tiny "previous rounds" history indicator. Sits at the bottom of the
 * apply page.
 *
 * Today: shows just the count (current - 1, floored at 0) so the user
 * has a passive reference to how many rounds have already closed.
 *
 * Tomorrow (per the spec note): swap the inner content for an actual
 * list once a roundHistoryStore exists. The wrapper styling stays —
 * this is the slot that holds future per-round entries.
 *
 * Style is intentionally faint: 9px courier mono, mute colour, opacity
 * 0.45. Reads as a watermark rather than UI.
 */
export default function RoundHistory() {
  const round = useRound();
  const previous = round !== null ? Math.max(0, round - 1) : null;

  return (
    <p
      className="font-mono text-xxxs uppercase tracking-widest2 text-mute mt-8 select-none"
      style={{ opacity: 0.45 }}
      aria-label={`round history — ${previous ?? "loading"} previous rounds`}
    >
      previous rounds: {previous ?? "—"}
    </p>
  );
}

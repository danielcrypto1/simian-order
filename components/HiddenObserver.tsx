"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * The "/the order/" page marker is also a hidden 3-click trigger.
 * Three quiet clicks reveal a faint "observed" tag in red beside the
 * marker. The reveal sticks for the rest of the session — visiting
 * other pages won't reset it (purely a visual easter egg).
 *
 * Mouse cursor stays default — there's no visual cue that anything is
 * clickable. That's the point.
 */
export default function HiddenObserver() {
  const [count, setCount] = useState(0);
  const revealed = count >= 3;

  const onClick = useCallback(() => {
    setCount((c) => {
      const next = c + 1;
      if (next === 3) track("hidden_observed");
      return next;
    });
  }, []);

  return (
    <div className="mb-6 flex items-baseline gap-3 tilt-l">
      <span className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
        ── you are inside ──
      </span>
      <button
        type="button"
        onClick={onClick}
        className="font-pixel text-bleed text-base leading-none bg-transparent border-0 p-0 cursor-default select-none"
        // Marked data-no-flash so the click flash doesn't visually
        // interfere with the reveal — keeps the easter egg subtle.
        data-no-flash
        aria-label="page marker"
      >
        /the order/
      </button>
      <span
        className={`observed-mark text-xs ${revealed ? "is-visible" : ""}`}
        aria-hidden={!revealed}
      >
        // observed
      </span>
    </div>
  );
}

"use client";

import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { OPENSEA_URL, OPENSEA_HIDDEN } from "@/lib/links";
import { track } from "@/lib/analytics";

/**
 * OpenSea link wrapper with an on-brand exit transition.
 *
 *   click → claim a new-tab handle synchronously (about:blank, so popup
 *           blockers don't fire) → show the dark glitch overlay →
 *           swap text from "redirecting..." to "secondary market" →
 *           navigate the reserved tab to OPENSEA_URL → fade overlay out.
 *
 * Total visible duration ≈ 950ms (180ms in / 380ms stage-1 / 380ms stage-2 /
 * 200ms out). Timeline matches the 500–900ms delay window in the brief.
 *
 * Modifier clicks (cmd/ctrl/shift/alt or middle-click) bypass the transition
 * entirely so power users can still open in their preferred tab/window.
 *
 * If the popup is blocked despite the about:blank reservation (rare —
 * usually requires aggressive user-side blockers), the link falls back to
 * a same-tab navigation after the transition so the user still arrives at
 * the destination.
 */

type Props = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Optional extra analytics label for the click site (e.g. "topbar"). */
  source?: string;
};

type Stage = "idle" | "in" | "secondary" | "out";

export default function OpenseaLink({ className, style, children, source }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const reservedRef = useRef<Window | null>(null);
  const timersRef = useRef<number[]>([]);

  // Tear down outstanding timers if the component unmounts mid-transition.
  useEffect(() => () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // Site-wide visibility flag. When hidden, render absolutely nothing —
  // call sites also gate their surrounding separators on the same flag
  // so the slash-list / nav row reflow cleanly. The transition logic,
  // about:blank reservation, and analytics fire-paths are all preserved
  // for the moment OPENSEA_HIDDEN flips back to false.
  if (OPENSEA_HIDDEN) return null;

  const onClick = useCallback((e: React.MouseEvent) => {
    // Honour modified clicks — let the browser do its native thing.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      // Track but don't intercept.
      try { track("opensea_click"); } catch { /* noop */ }
      return;
    }
    e.preventDefault();

    // Already mid-transition — ignore re-clicks so timers don't double up.
    if (stage !== "idle") return;

    // Reserve the new tab WITHIN the user-gesture stack so popup blockers
    // don't fire later. about:blank takes the active gesture; we'll
    // navigate it once the overlay sequence finishes.
    const win = window.open("about:blank", "_blank");
    if (!win) {
      // Popup blocked outright. Skip the overlay and fall back to
      // same-tab nav so the user still gets where they're going.
      window.location.href = OPENSEA_URL;
      return;
    }
    reservedRef.current = win;

    try { track("opensea_click"); } catch { /* noop */ }

    setStage("in");
    timersRef.current.push(
      window.setTimeout(() => setStage("secondary"), 380),
      window.setTimeout(() => {
        try {
          // Mitigate window.opener on the new tab before navigating.
          if (reservedRef.current) {
            reservedRef.current.opener = null;
            reservedRef.current.location.replace(OPENSEA_URL);
          }
        } catch {
          // Some browsers throw on cross-origin opener access — fall back.
          window.open(OPENSEA_URL, "_blank", "noopener,noreferrer");
        }
        setStage("out");
      }, 760),
      window.setTimeout(() => {
        setStage("idle");
        reservedRef.current = null;
      }, 1100)
    );
  }, [stage]);

  return (
    <>
      <a
        href={OPENSEA_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={className}
        style={style}
        data-source={source}
      >
        {children}
      </a>

      {stage !== "idle" && (
        <div
          className={`opensea-exit opensea-exit--${stage}`}
          aria-hidden
          aria-live="polite"
          data-no-flash
        >
          {/* Slightly drifting noise layer for texture */}
          <div className="opensea-exit__noise" />
          {/* Real Glitch.png at low opacity — reuses the asset already
              shipped with the site so this transition stays asset-free. */}
          <div className="opensea-exit__glitch" />
          {/* Centered text — stage-1 then stage-2 swap. */}
          <p className="opensea-exit__text">
            {stage === "in" ? (
              <>redirecting<span className="blink">_</span></>
            ) : (
              <>secondary market<span className="text-bleed">.</span></>
            )}
          </p>
          {/* Tiny system caption underneath, off-axis */}
          <p className="opensea-exit__caption">
            // exiting the order &mdash; opensea.io
          </p>
        </div>
      )}
    </>
  );
}

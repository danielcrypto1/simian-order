"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Hard black mark + serif italic "S" with a harsh red drop-shadow.
 *
 * Hidden interactions:
 *   1. Hover ≥ 2s → wordmark briefly swaps to "watching" (1.1s) then reverts.
 *   2. Click 5 times → reveals a tiny [ deeper ] link beside the logo
 *      that routes to /void. The reveal persists for the rest of the
 *      session (sessionStorage-backed). Clicks are absorbed when they hit
 *      the badge so the navigation to / does not happen until the
 *      counter resets after a successful reveal.
 *   3. Tap 3 times rapidly (within 700ms) → dispatches the global
 *      "simian:alignment" custom event so the InteractionLayer fires
 *      its alignment-detected overlay. Independent of the 5-click
 *      counter — both can land in a single sequence.
 *
 * The clickable layer is a <button> overlaying the badge with
 * `pointer-events: auto`. The Link wraps both, but the button captures
 * clicks first and stops propagation so the user only navigates to "/"
 * when they click the wordmark, not the badge.
 */
export default function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";

  // 2s-hover reveal
  const [revealed, setRevealed] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  // 5-click "deeper" reveal — sessionStorage-persisted
  const [deeper, setDeeper] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<number | null>(null);

  // 3-rapid-tap "alignment detected" — fires when 3 taps land within
  // a 700ms window. Tap timestamps tracked in a small ring buffer.
  const tapTimes = useRef<number[]>([]);
  const TAP_WINDOW_MS = 700;

  useEffect(() => {
    try {
      if (sessionStorage.getItem("simian_deeper") === "1") {
        setDeeper(true);
      }
    } catch { /* storage blocked — skip */ }
    return () => {
      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
      if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    };
  }, []);

  const onEnter = () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setRevealed(true);
      hoverTimer.current = window.setTimeout(() => setRevealed(false), 1100);
    }, 2000);
  };
  const onLeave = () => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  // Badge click handler — absorbs clicks for the easter egg without
  // navigating. Resets the counter after 2s of inactivity so a slow
  // sequence doesn't accidentally count. Also feeds the 3-rapid-tap
  // window for the alignment-detected secret.
  const onBadgeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // ── 5-click [ deeper ] easter egg ────────────────────────────
    clickCount.current += 1;
    if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      clickCount.current = 0;
    }, 2000);
    if (clickCount.current >= 5 && !deeper) {
      setDeeper(true);
      try { sessionStorage.setItem("simian_deeper", "1"); } catch { /* skip */ }
      track("secret_logo_deeper");
      clickCount.current = 0;
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    }

    // ── 3-rapid-tap alignment ────────────────────────────────────
    const now = Date.now();
    tapTimes.current.push(now);
    // Keep only the most recent 3 within the rolling window.
    tapTimes.current = tapTimes.current.filter((t) => now - t <= TAP_WINDOW_MS);
    if (tapTimes.current.length >= 3) {
      try {
        window.dispatchEvent(new CustomEvent("simian:alignment"));
        track("secret_logo_3tap");
      } catch { /* noop */ }
      tapTimes.current = []; // reset so the next 3 fires again
    }
  };

  return (
    <span
      className="inline-flex items-center gap-2"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Link href="/" className="no-underline group inline-flex items-center gap-2">
        {/* The badge. Clicks here are intercepted by the overlay button
            below — the Link still handles keyboard activation. */}
        <span className="relative inline-flex">
          <span
            className={`relative inline-flex items-center justify-center bg-black border border-bone text-bone font-serif italic ${
              big ? "w-12 h-12 text-3xl" : "w-6 h-6 text-base"
            }`}
            style={{ boxShadow: big ? "3px 3px 0 #ff2d2d" : "2px 2px 0 #ff2d2d" }}
          >
            S
          </span>
          {/* Invisible click-capture overlay */}
          <button
            type="button"
            aria-label="badge"
            onClick={onBadgeClick}
            className="absolute inset-0 cursor-default"
            style={{ background: "transparent", border: "none", padding: 0 }}
            data-no-flash
          />
        </span>
        <span
          className={`text-bone font-serif italic group-hover:text-elec ${
            big ? "text-2xl" : "text-sm"
          }`}
        >
          {revealed ? <span className="logo-watch">watching</span> : "Simian Order"}
        </span>
      </Link>

      {/* Hidden [ deeper ] link — appears once 5 badge clicks accumulate */}
      {deeper && (
        <Link
          href="/void"
          prefetch={false}
          className="text-link reveal text-bleed ml-2"
          style={{ fontSize: "11px", transform: "rotate(-1.5deg)" }}
          data-no-flash
        >
          [ deeper ]
        </Link>
      )}
    </span>
  );
}

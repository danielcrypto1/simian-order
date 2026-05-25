"use client";

import { useEffect, useState } from "react";
import { useRound } from "@/lib/useRound";
import { OPENSEA_URL, OPENSEA_HIDDEN } from "@/lib/links";

/**
 * Single-line live system strip below the TopBar.
 *
 * Post-mint: dropped phase / FCFS / supply / royalty (the mint-era
 * fields). Now shows round / status / market / utc-clock — slimmer,
 * focused on what's still meaningful while the collection lives on
 * the secondary market.
 */
export default function TerminalBar() {
  const round = useRound();
  // CRITICAL: do NOT seed the clock with `new Date()` here — the
  // server's wall clock at SSR will not match the client's wall
  // clock at hydrate, throwing React errors #418 / #423 / #425
  // on every page load. Start empty, fill in via useEffect.
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    setNow(fmt(new Date()));
    const tick = setInterval(() => setNow(fmt(new Date())), 1_000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="border-b border-border bg-black/80">
      <div className="max-w-[1300px] mx-auto px-3 py-1 flex items-center gap-x-4 gap-y-1 flex-wrap font-mono text-xxxs uppercase tracking-widest2">
        <span className="text-elec">&gt;</span>
        <span className="text-mute">round:</span>
        <span className="text-bone">{round ?? "—"}</span>
        <span className="text-mute">/</span>
        <span className="text-mute">status:</span>
        <span className="text-bone">live</span>
        <span className="text-mute">/</span>
        <span className="text-mute">opensea:</span>
        {OPENSEA_HIDDEN ? (
          <span className="text-bone">loading<span className="blink">_</span></span>
        ) : (
          <a
            href={OPENSEA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-elec no-underline hover:text-bleed"
          >
            live ↗
          </a>
        )}
        {/* suppressHydrationWarning is belt-and-braces — even with the
            empty initial state, the time may flicker once on hydrate. */}
        <span className="ml-auto text-bleed" suppressHydrationWarning>
          {now ? `${now} utc` : " "}
        </span>
        <span className="text-bleed blink">_</span>
      </div>
    </div>
  );
}

function fmt(d: Date): string {
  return d.toISOString().slice(11, 19);
}

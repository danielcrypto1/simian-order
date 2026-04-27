"use client";

import { useEffect, useState } from "react";

/**
 * Tiny client hook for the current round number.
 *
 * Fetches /api/round once on mount, caches in module scope so subsequent
 * page renders within the same SPA session reuse the value without
 * another network round-trip. Returns `null` until the first fetch
 * resolves so callers can render a placeholder.
 *
 * Usage:
 *   const round = useRound();
 *   <h1>round {round ?? "—"}</h1>
 */

let cached: number | null = null;

export function useRound(): number | null {
  const [round, setRound] = useState<number | null>(cached);

  useEffect(() => {
    if (cached !== null) return;
    let alive = true;
    fetch("/api/round", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { roundNumber?: number } | null) => {
        if (!alive || !j) return;
        const n = Number(j.roundNumber);
        if (Number.isFinite(n) && n >= 1) {
          cached = Math.floor(n);
          setRound(cached);
        }
      })
      .catch(() => { /* swallow — page renders with null */ });
    return () => { alive = false; };
  }, []);

  return round;
}

/**
 * One-shot fetch helper for non-React contexts (e.g. event handlers).
 * Returns the cached value if available, otherwise a fresh fetch.
 */
export async function fetchRound(): Promise<number> {
  if (cached !== null) return cached;
  try {
    const r = await fetch("/api/round", { cache: "no-store" });
    if (!r.ok) return 1;
    const j = (await r.json()) as { roundNumber?: number };
    const n = Number(j.roundNumber);
    if (Number.isFinite(n) && n >= 1) {
      cached = Math.floor(n);
      return cached;
    }
  } catch { /* fall through */ }
  return 1;
}

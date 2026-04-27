"use client";

import { useEffect, useState } from "react";

/**
 * Tiny client hook for the current round number.
 *
 * Architecture:
 *   - One module-scoped cache + one shared poller for the whole SPA so
 *     every <useRound>-bound component sees the same value at the same
 *     time without each one running its own fetch.
 *   - Periodic poll every 60s.
 *   - Tab-focus refetch (visibilitychange → visible) so an admin who
 *     bumps the round and switches tabs sees the new value within ~1s
 *     of returning to the user surface.
 *   - Listener fan-out: every mounted hook subscribes; when the cache
 *     changes, all subscribers re-render together (no duplicate fetches).
 *
 * Returns null until the first fetch resolves so callers can render a
 * placeholder ("—" or similar).
 *
 * Usage:
 *   const round = useRound();
 *   <h1>round {round ?? "—"}</h1>
 */

const POLL_MS = 60_000;
const FOCUS_MIN_GAP_MS = 5_000;

let cached: number | null = null;
let lastFetchAt = 0;
let pollerStarted = false;
const listeners = new Set<(n: number) => void>();

async function refetch(): Promise<void> {
  try {
    // Use the spec'd /api/config endpoint. /api/round still works as
    // an alias on the server and is interchangeable here.
    const r = await fetch("/api/config", { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { roundNumber?: number };
    const n = Number(j.roundNumber);
    if (!Number.isFinite(n) || n < 1) return;
    const next = Math.floor(n);
    const changed = next !== cached;
    cached = next;
    if (changed) {
      // Snapshot to avoid mutation-during-iteration if a listener
      // unsubscribes mid-broadcast.
      Array.from(listeners).forEach((fn) => {
        try { fn(next); } catch { /* listener errors don't block siblings */ }
      });
    }
  } catch { /* swallow — keep last cached value */ }
  lastFetchAt = Date.now();
}

function ensurePoller(): void {
  if (pollerStarted) return;
  pollerStarted = true;
  if (typeof window === "undefined") return;
  // Periodic poll
  window.setInterval(refetch, POLL_MS);
  // Refetch on tab regaining focus, but only if it's been a moment —
  // avoid hammering the gist when the user alt-tabs rapidly.
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      Date.now() - lastFetchAt > FOCUS_MIN_GAP_MS
    ) {
      refetch();
    }
  });
}

export function useRound(): number | null {
  const [round, setRound] = useState<number | null>(cached);

  useEffect(() => {
    listeners.add(setRound);
    ensurePoller();
    // Kick off the first fetch only if nobody's done it yet.
    if (cached === null) refetch();
    return () => { listeners.delete(setRound); };
  }, []);

  return round;
}

/**
 * One-shot fetch helper for non-React contexts (e.g. event handlers).
 * Returns the cached value if available, otherwise a fresh fetch.
 * Falls back to 1 if everything fails.
 */
export async function fetchRound(): Promise<number> {
  if (cached !== null) return cached;
  await refetch();
  return cached ?? 1;
}

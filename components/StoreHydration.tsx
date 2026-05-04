"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Triggers Zustand persist rehydration AFTER the first client render.
 *
 * The store is configured with `skipHydration: true` (see lib/store.ts)
 * so it stays at initialState during module load. That keeps the very
 * first client render identical to the SSR'd HTML — matching React's
 * hydration expectations and avoiding React errors #418 / #423 / #425.
 *
 * This component runs once on mount and calls `persist.rehydrate()`,
 * which loads localStorage values and re-renders any subscriber that
 * depends on them. From the user's perspective the form pre-fill /
 * "the order recognises you" greeting / saved task ticks all appear
 * within the same paint as the rest of the page — there's no flash
 * because the rehydrate is synchronous against localStorage.
 *
 * Renders nothing.
 */
export default function StoreHydration() {
  useEffect(() => {
    // useStore.persist is added by the persist middleware. Calling
    // rehydrate() returns a promise (sync against localStorage) — we
    // don't need to await it.
    void (useStore as unknown as {
      persist: { rehydrate: () => Promise<void> | void };
    }).persist.rehydrate();
  }, []);

  return null;
}

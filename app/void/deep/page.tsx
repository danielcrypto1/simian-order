"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VoidDeepChaos from "@/components/VoidDeepChaos";

/**
 * /void/deep — auto-claim entry point.
 *
 * On visit we POST to /api/backroom/auto-claim. The server mints a
 * cookie if missing, issues the next sequential ORDER #N (or returns
 * the existing claim for this cookie), and we redirect the visitor to
 * /void/deep/[slug] where the cinematic plays and the code is
 * revealed at the end.
 *
 * Edge cases:
 *   - 500 cap reached → server returns `full: true`. We render the
 *     cinematic in "full" mode and the reveal panel reads ACCESS
 *     CLOSED instead of showing a code.
 *   - Network error → fall back to the cinematic-only no-code variant
 *     (returns to /). Better than a broken page.
 *
 * The redirect happens fast (<300ms in dev, similar in prod), so the
 * visitor sees a brief black "// resolving" line before the cinematic
 * starts on /void/deep/[slug].
 */
export default function VoidDeepPage() {
  const router = useRouter();
  const [state, setState] = useState<"resolving" | "full" | "error">("resolving");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/backroom/auto-claim", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (cancelled || !j) {
          if (!cancelled) setState("error");
          return;
        }
        if (j.ok && typeof j.slug === "string") {
          router.replace(`/void/deep/${j.slug}`);
          return;
        }
        if (j.full) {
          setState("full");
          return;
        }
        setState("error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => { cancelled = true; };
  }, [router]);

  if (state === "resolving") {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-black text-bone select-none">
        <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xxs text-mute uppercase tracking-widest2">
          &gt; resolving<span className="blink">_</span>
        </p>
      </main>
    );
  }

  // Full → cinematic with ACCESS CLOSED reveal.
  // Error → fall back to cinematic-only, returns to / on its own.
  return <VoidDeepChaos full={state === "full"} />;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import VoidDeepChaos from "@/components/VoidDeepChaos";
import { parseOrderSlug, slugToDisplayCode } from "@/lib/orderCodes";

/**
 * /void/deep/[code] — the post-claim reveal flow.
 *
 * The route resolves a URL slug into the display code, plays the chaos
 * cinematic, then ends on a held reveal panel showing the code with a
 * copy button + discord claim link.
 *
 * Two slug formats are accepted:
 *   - Legacy: "order-7" → "ORDER #7" (pre-random-rollout claims)
 *   - Random: "k7x2-pq9f" → "K7X2-PQ9F" (current format)
 *
 * Predictable-looking URLs are intentional — the visitor's actual
 * entitlement is the wallet/code binding stored server-side and
 * verified by the admin via the discord ticket. The /void/deep/[code]
 * URL is just the public delivery surface for the assigned code.
 */
export default function VoidDeepCodePage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = slugToDisplayCode(params.code);

  // If the slug isn't a known code shape, send the visitor to the
  // no-code chaos page so they still get the experience but no false
  // reveal.
  useEffect(() => {
    if (code === null) router.replace("/void/deep");
  }, [code, router]);

  if (code === null) return null;

  // Legacy slugs carry an index (the N in ORDER #N) so the "remaining"
  // counter on the reveal panel can still tick. Random-code slugs don't
  // encode a position, so the panel just omits that line.
  const legacyIndex = parseOrderSlug(params.code);
  return <VoidDeepChaos code={code} index={legacyIndex} />;
}

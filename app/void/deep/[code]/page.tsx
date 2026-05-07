"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import VoidDeepChaos from "@/components/VoidDeepChaos";
import { parseOrderSlug, formatOrderCode } from "@/lib/orderCodes";

/**
 * /void/deep/[code] — the post-claim reveal flow.
 *
 * The route resolves a slug like "order-7" into a 1-based index, plays
 * the chaos cinematic, then ends on a held reveal panel showing
 * "ORDER #7" with a copy button + discord claim link.
 *
 * Predictable URL is intentional — the visitor's actual entitlement is
 * the wallet/code binding stored server-side and verified by the admin
 * via the discord ticket. The /void/deep/[code] URL is just the public
 * delivery surface for the assigned code.
 */
export default function VoidDeepCodePage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const index = parseOrderSlug(params.code);

  // If the slug doesn't resolve to a valid 1..500 index, kick the
  // visitor to the no-code chaos page so they still get the
  // experience but no false reveal.
  useEffect(() => {
    if (index === null) router.replace("/void/deep");
  }, [index, router]);

  if (index === null) return null;

  const code = formatOrderCode(index);
  return <VoidDeepChaos code={code} index={index} />;
}

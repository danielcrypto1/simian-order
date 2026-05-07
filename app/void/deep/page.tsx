"use client";

import VoidDeepChaos from "@/components/VoidDeepChaos";

/**
 * /void/deep — chaos experience for stragglers who reach the page
 * without an issued code. The cinematic plays for ~12s and then
 * returns the visitor to home.
 *
 * The post-/backroom flow uses /void/deep/[code]/ instead — same
 * cinematic, but ends on a held reveal screen with the visitor's
 * ORDER #N code, a copy button, and a discord claim link.
 *
 * All the heavy lifting (chaos engine, audio, freeze, return-to-home)
 * lives in <VoidDeepChaos />. This page is the no-code variant.
 */
export default function VoidDeepPage() {
  return <VoidDeepChaos />;
}

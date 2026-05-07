import { NextResponse } from "next/server";
import { adminResetClaims } from "@/lib/backroomStore";

export const runtime = "nodejs";

/**
 * POST /api/admin/backroom/reset
 *
 * Wipes the issued-claims array. The sequential ORDER #N counter
 * restarts at #1 on the next claim. Visitor cookies remain on the
 * client; affected visitors will be issued a fresh code on their
 * next /void/deep visit (their old cookie hasn't been invalidated,
 * but the matching claim record is gone, so the auto-claim path
 * mints them a new entry).
 */
export async function POST() {
  await adminResetClaims();
  return NextResponse.json({ ok: true });
}

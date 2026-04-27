import { NextResponse } from "next/server";
import { getRound } from "@/lib/roundStore";

export const runtime = "nodejs";
// Always read fresh from the gist so an admin round bump propagates the
// next time any client polls /api/config.
export const dynamic = "force-dynamic";

/**
 * Public config read.
 *
 *   GET /api/config  →  { roundNumber: number }
 *
 * Spec-defined endpoint. Functionally identical to GET /api/round (kept
 * as an alias for the existing useRound hook); both go through the same
 * gist-backed roundStore so a single write is reflected on every read.
 */
export async function GET() {
  const r = await getRound();
  return NextResponse.json({ roundNumber: r.roundNumber });
}

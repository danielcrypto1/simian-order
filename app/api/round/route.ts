import { NextResponse } from "next/server";
import { getRound } from "@/lib/roundStore";

export const runtime = "nodejs";
// Each request reads from the gist — no edge caching, so a round bump in
// admin propagates immediately. Volume is tiny (one fetch per page load).
export const dynamic = "force-dynamic";

/**
 * Public read of the current round number.
 *
 *   GET /api/round  →  { roundNumber: number }
 *
 * Used by the client `useRound` hook to render headlines, terminal bar,
 * approval-share tweet text, etc. Admin updates via PATCH /api/admin/config
 * with `{ round_number }`.
 */
export async function GET() {
  const r = await getRound();
  return NextResponse.json({ roundNumber: r.roundNumber });
}

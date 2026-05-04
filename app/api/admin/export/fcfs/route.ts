import { NextResponse } from "next/server";
import { adminGetState } from "@/lib/backroomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export/fcfs
 *
 * OpenSea-ready CSV export of every wallet that has claimed a BACK
 * ROOM code (the 500-cap, first-come-first-served list). Format:
 *
 *   wallet_address,quantity
 *   0xabc...,1
 *   ...
 *
 * Rules:
 *   - one row per unique wallet (lowercased + de-duplicated)
 *   - quantity is always 1
 *   - claims without a wallet (legacy pre-wallet-binding rows) are
 *     skipped — they can't be airdropped to anyway
 *
 * Auth: gated by the /api/admin/* middleware (cookie session).
 */
export async function GET() {
  const state = await adminGetState();
  const seen = new Set<string>();
  const lines: string[] = ["wallet_address,quantity"];
  for (const c of state.claims) {
    const w = (c.wallet || "").toLowerCase().trim();
    if (!w) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    lines.push(`${w},1`);
  }
  const body = lines.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fcfs.csv"`,
      "cache-control": "no-store",
    },
  });
}

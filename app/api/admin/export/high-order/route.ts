import { NextResponse } from "next/server";
import { listApplications } from "@/lib/applicationsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export/high-order
 *
 * OpenSea-ready CSV export of every wallet that has been APPROVED in
 * the HIGH ORDER application queue. Format:
 *
 *   wallet_address,quantity
 *   0xabc...,1
 *   0xdef...,1
 *
 * Rules:
 *   - one row per unique wallet (lowercased + de-duplicated)
 *   - quantity is always 1
 *   - rejected and pending applications are excluded
 *
 * Auth: gated by the /api/admin/* middleware (cookie session).
 */
export async function GET() {
  const apps = await listApplications();
  const seen = new Set<string>();
  const lines: string[] = ["wallet_address,quantity"];
  for (const a of apps) {
    if (a.status !== "approved") continue;
    const w = a.wallet.toLowerCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    lines.push(`${w},1`);
  }
  const body = lines.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="high-order.csv"`,
      "cache-control": "no-store",
    },
  });
}

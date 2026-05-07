import { NextResponse } from "next/server";
import { adminGetState, BACKROOM_TOTAL } from "@/lib/backroomStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/backroom
 *
 * Returns the full back-room state for the admin panel:
 *   {
 *     total: 500,
 *     remaining: number,
 *     claimed: number,
 *     full: boolean,
 *     claims: [{ code, index, wallet, visitorId, ipHash, source, claimedAt }],
 *     updatedAt: string,
 *   }
 *
 * Auth: gated by the /api/admin/* middleware. Codes are auto-issued
 * sequentially at /void/deep — there are no admin levers besides the
 * reset (POST /api/admin/backroom/reset).
 */
export async function GET() {
  const s = await adminGetState();
  const claimed = s.claims.length;
  return NextResponse.json({
    total: BACKROOM_TOTAL,
    remaining: Math.max(0, BACKROOM_TOTAL - claimed),
    claimed,
    full: claimed >= BACKROOM_TOTAL,
    claims: s.claims,
    updatedAt: s.updatedAt,
  });
}

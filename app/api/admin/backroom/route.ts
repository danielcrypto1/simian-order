import { NextResponse } from "next/server";
import {
  adminGetState,
  adminSetPassphrase,
  BACKROOM_TOTAL,
} from "@/lib/backroomStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/backroom
 *
 * Returns the full back-room state for the admin panel:
 *   {
 *     passphrase: string | null,
 *     total: 500,
 *     remaining: number,
 *     claimed: number,
 *     full: boolean,
 *     claims: [{ code, index, wallet, visitorId, ipHash, claimedAt }],
 *   }
 *
 * Auth: gated by the /api/admin/* middleware.
 */
export async function GET() {
  const s = await adminGetState();
  const claimed = s.claims.length;
  return NextResponse.json({
    passphrase: s.passphrase,
    total: BACKROOM_TOTAL,
    remaining: Math.max(0, BACKROOM_TOTAL - claimed),
    claimed,
    full: claimed >= BACKROOM_TOTAL,
    claims: s.claims,
    updatedAt: s.updatedAt,
  });
}

/**
 * POST /api/admin/backroom
 *
 * Body shape:
 *   { passphrase: string }   — set passphrase visitors must type
 *
 * Codes are auto-issued sequentially as "ORDER #1", "ORDER #2", ...
 * — no admin-set "drop code" anymore. Existing claims are NOT cleared —
 * use POST /api/admin/backroom/reset to wipe and restart at #1.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const b = body as Record<string, unknown>;

  const p = b.passphrase;
  if (typeof p !== "string") {
    return NextResponse.json({ error: "invalid_passphrase" }, { status: 400 });
  }
  const trimmed = p.trim().slice(0, 128);
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "passphrase_empty" }, { status: 400 });
  }
  await adminSetPassphrase(trimmed);
  return NextResponse.json({ ok: true, passphrase: trimmed });
}

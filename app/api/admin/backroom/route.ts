import { NextResponse } from "next/server";
import {
  adminGetState,
  adminSetPassphrase,
  adminSetDropCode,
  adminRegenerateDropCode,
  BACKROOM_TOTAL,
} from "@/lib/backroomStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/backroom
 *
 * Returns the full back-room state for the admin panel:
 *   {
 *     passphrase: string | null,
 *     dropCode: string | null,    // shared code returned to all claimers
 *     total: 500,
 *     remaining: number,
 *     claimed: number,
 *     full: boolean,
 *     claims: [{ code, wallet, visitorId, ipHash, claimedAt }],
 *   }
 *
 * Auth: gated by the /api/admin/* middleware.
 */
export async function GET() {
  const s = await adminGetState();
  const claimed = s.claims.length;
  return NextResponse.json({
    passphrase: s.passphrase,
    dropCode: s.dropCode,
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
 * Body shapes (one of):
 *   { passphrase: string }              — set passphrase visitors must type
 *   { dropCode: string | null }         — set the shared code returned to claimers (null clears)
 *   { regenerateDropCode: true }        — replace drop code with a fresh XXXX-XXXX
 *
 * Existing claims are NOT cleared — use POST /api/admin/backroom/reset.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const b = body as Record<string, unknown>;

  // Branch 1 — regenerate drop code
  if (b.regenerateDropCode === true) {
    const next = await adminRegenerateDropCode();
    return NextResponse.json({ ok: true, dropCode: next });
  }

  // Branch 2 — set or clear drop code
  if ("dropCode" in b) {
    const dc = b.dropCode;
    if (dc === null) {
      await adminSetDropCode(null);
      return NextResponse.json({ ok: true, dropCode: null });
    }
    if (typeof dc !== "string") {
      return NextResponse.json({ error: "invalid_drop_code" }, { status: 400 });
    }
    const trimmed = dc.trim().slice(0, 64);
    await adminSetDropCode(trimmed.length === 0 ? null : trimmed);
    return NextResponse.json({ ok: true, dropCode: trimmed.length === 0 ? null : trimmed });
  }

  // Branch 3 — set passphrase (default / legacy shape)
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

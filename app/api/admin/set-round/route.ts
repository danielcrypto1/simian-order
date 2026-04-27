import { NextResponse } from "next/server";
import { setRound } from "@/lib/roundStore";

export const runtime = "nodejs";

/**
 * Admin: set the current round number.
 *
 *   POST /api/admin/set-round
 *   body: { roundNumber: number }   // integer ≥ 1
 *   res:  { ok: true, roundNumber: number }
 *
 * Persisted via the gist-backed roundStore (same file the public
 * /api/config + /api/round endpoints read from). Auth is enforced by
 * the existing admin middleware that gates every /api/admin/* route.
 *
 * Errors:
 *   400 invalid_json         — body wasn't valid JSON
 *   400 missing_round_number — body lacked the field
 *   400 invalid_round_number — value wasn't a positive integer
 *   500 write_failed         — gist PATCH failed (rare)
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { roundNumber?: unknown };

  if (b.roundNumber === undefined || b.roundNumber === null) {
    return NextResponse.json({ error: "missing_round_number" }, { status: 400 });
  }
  const n = Number(b.roundNumber);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "invalid_round_number" }, { status: 400 });
  }

  try {
    const next = await setRound(n);
    return NextResponse.json({ ok: true, roundNumber: next.roundNumber });
  } catch (e) {
    return NextResponse.json(
      { error: "write_failed", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

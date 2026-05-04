import { NextResponse } from "next/server";
import { getRound, setRound } from "@/lib/roundStore";

export const runtime = "nodejs";

/**
 * Admin-only runtime config. With the on-chain mint and whitelist
 * removed, the only mutable runtime value is the round number; all
 * supply / phase / royalty knobs are gone.
 */
export async function GET() {
  const round = await getRound();
  return NextResponse.json({
    round_number: round.roundNumber,
  });
}

export async function PATCH(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const b = body as Record<string, unknown>;

  let roundOut: number | undefined;
  if ("round_number" in b) {
    const r = Number(b.round_number);
    if (!Number.isFinite(r) || !Number.isInteger(r) || r < 1) {
      return NextResponse.json({ error: "invalid_round_number" }, { status: 400 });
    }
    const saved = await setRound(r);
    roundOut = saved.roundNumber;
  }

  return NextResponse.json({
    ...(roundOut !== undefined ? { round_number: roundOut } : {}),
  });
}

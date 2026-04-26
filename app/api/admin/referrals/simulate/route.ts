import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { addReferral } from "@/lib/referralsStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function randomWallet(): string {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

export async function POST(req: Request) {
  let body: unknown = {};
  try { body = await req.json(); } catch {}
  const b = body as { referrer?: unknown; referee?: unknown };

  const referrer = typeof b.referrer === "string" ? b.referrer.trim() : "";
  if (!isWallet(referrer)) {
    return NextResponse.json({ error: "invalid_referrer_wallet" }, { status: 400 });
  }

  // Referee is optional — if absent, generate a random one for testing.
  let referee = typeof b.referee === "string" && b.referee.trim()
    ? b.referee.trim()
    : randomWallet();
  if (!isWallet(referee)) {
    return NextResponse.json({ error: "invalid_referee_wallet" }, { status: 400 });
  }

  const r = await addReferral(referrer, referee);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, referrer, referee, link: r.link });
}

import { NextResponse } from "next/server";
import { removeReferral } from "@/lib/referralsStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function POST(req: Request) {
  let body: unknown = {};
  try { body = await req.json(); } catch {}
  const b = body as { referrer?: unknown; referee?: unknown };
  if (typeof b.referrer !== "string" || !isWallet(b.referrer)) {
    return NextResponse.json({ error: "invalid_referrer_wallet" }, { status: 400 });
  }
  if (typeof b.referee !== "string" || !isWallet(b.referee)) {
    return NextResponse.json({ error: "invalid_referee_wallet" }, { status: 400 });
  }
  const removed = await removeReferral(b.referrer, b.referee);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

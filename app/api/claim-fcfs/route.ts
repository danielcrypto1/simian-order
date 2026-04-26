import { NextResponse } from "next/server";
import { claimFcfs, getFcfsState } from "@/lib/fcfsStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function GET() {
  const s = await getFcfsState();
  return NextResponse.json({
    total: s.total,
    taken: s.taken,
    remaining: Math.max(0, s.total - s.taken),
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body as { wallet?: unknown })?.wallet;
  if (typeof raw !== "string" || !isWallet(raw)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const wallet = raw.toLowerCase();

  const r = await claimFcfs(wallet);
  if (!r.ok) {
    return NextResponse.json(
      {
        error: r.error,
        total: r.state.total,
        taken: r.state.taken,
        remaining: Math.max(0, r.state.total - r.state.taken),
      },
      { status: 409 }
    );
  }
  return NextResponse.json({
    ok: true,
    wallet,
    total: r.state.total,
    taken: r.state.taken,
    remaining: Math.max(0, r.state.total - r.state.taken),
  });
}

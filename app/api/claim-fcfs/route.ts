import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function GET() {
  const { fcfsState } = getStore();
  return NextResponse.json({
    total: fcfsState.total,
    taken: fcfsState.taken,
    remaining: Math.max(0, fcfsState.total - fcfsState.taken),
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

  const { fcfsState } = getStore();
  if (fcfsState.claimed.has(wallet)) {
    return NextResponse.json(
      {
        error: "already_claimed",
        total: fcfsState.total,
        taken: fcfsState.taken,
        remaining: Math.max(0, fcfsState.total - fcfsState.taken),
      },
      { status: 409 }
    );
  }
  if (fcfsState.taken >= fcfsState.total) {
    return NextResponse.json(
      {
        error: "fcfs_full",
        total: fcfsState.total,
        taken: fcfsState.taken,
        remaining: 0,
      },
      { status: 409 }
    );
  }

  fcfsState.claimed.add(wallet);
  fcfsState.taken += 1;

  return NextResponse.json({
    ok: true,
    wallet,
    total: fcfsState.total,
    taken: fcfsState.taken,
    remaining: Math.max(0, fcfsState.total - fcfsState.taken),
  });
}

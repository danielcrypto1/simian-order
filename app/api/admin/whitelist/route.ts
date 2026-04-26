import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
import { isWallet } from "@/lib/whitelistParser";

export const runtime = "nodejs";

export async function GET() {
  const store = getStore();
  const items = Array.from(store.whitelist.values()).sort((a, b) => a.addedAt < b.addedAt ? -1 : 1);
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const b = body as { wallet?: unknown; phase?: unknown; maxMint?: unknown };
  const wallet = String(b.wallet ?? "").trim().toLowerCase();
  const phase = String(b.phase ?? "").trim().toUpperCase();
  const maxMint = Number(b.maxMint);
  if (!isWallet(wallet)) return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  if (phase !== "GTD" && phase !== "FCFS") return NextResponse.json({ error: "invalid_phase" }, { status: 400 });
  if (!Number.isFinite(maxMint) || !Number.isInteger(maxMint) || maxMint < 1) {
    return NextResponse.json({ error: "invalid_max_mint" }, { status: 400 });
  }
  const store = getStore();
  const entry = { wallet, phase: phase as "GTD" | "FCFS", maxMint, addedAt: new Date().toISOString() };
  store.whitelist.set(wallet, entry);
  return NextResponse.json({ ok: true, entry });
}

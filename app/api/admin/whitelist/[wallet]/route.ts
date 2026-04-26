import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
import { isWallet } from "@/lib/whitelistParser";

export const runtime = "nodejs";

type Ctx = { params: { wallet: string } };

export async function PUT(req: Request, { params }: Ctx) {
  const wallet = params.wallet.toLowerCase();
  if (!isWallet(wallet)) return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const b = body as { phase?: unknown; maxMint?: unknown };
  const phase = String(b.phase ?? "").trim().toUpperCase();
  const maxMint = Number(b.maxMint);
  if (phase !== "GTD" && phase !== "FCFS") return NextResponse.json({ error: "invalid_phase" }, { status: 400 });
  if (!Number.isFinite(maxMint) || !Number.isInteger(maxMint) || maxMint < 1) {
    return NextResponse.json({ error: "invalid_max_mint" }, { status: 400 });
  }
  const store = getStore();
  const existing = store.whitelist.get(wallet);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const entry = { ...existing, phase: phase as "GTD" | "FCFS", maxMint };
  store.whitelist.set(wallet, entry);
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const wallet = params.wallet.toLowerCase();
  const store = getStore();
  const had = store.whitelist.delete(wallet);
  return NextResponse.json({ ok: true, deleted: had });
}

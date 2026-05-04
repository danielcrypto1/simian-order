import { NextResponse } from "next/server";
import { upsertKol, removeKol, listKols } from "@/lib/kolStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: KOL tag registry CRUD.
 *
 *   GET /api/admin/kol
 *   →  { items: KolEntry[] }
 *
 *   POST /api/admin/kol
 *   body: { wallet, tag?: string }
 *   →  { ok: true, entry: KolEntry }
 *   Tags an existing entry (overwrites the tag) or creates a new one.
 *
 *   DELETE /api/admin/kol
 *   body: { wallet }
 *   →  { ok: true }   (404 if not found)
 *
 * Used by the SUBMITTED REFERRALS panel to flag a referrer as a
 * KOL so the badge surfaces inline. Tag is free-form text up to
 * 64 chars (e.g. "early ape", "twitter:@x", "discord:y") — admin
 * choice.
 */
export async function GET() {
  const items = await listKols();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { wallet?: unknown; tag?: unknown };
  if (typeof b.wallet !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const tag = typeof b.tag === "string" ? b.tag : "";
  const entry = await upsertKol(b.wallet, tag);
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { wallet?: unknown };
  if (typeof b.wallet !== "string") {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const ok = await removeKol(b.wallet);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

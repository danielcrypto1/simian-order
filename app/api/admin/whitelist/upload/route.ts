import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
import { parseFileBuffer, validateRows } from "@/lib/whitelistParser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: "invalid_form" }, { status: 400 }); }

  const file = fd.get("file");
  const mode = String(fd.get("mode") ?? "append");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (mode !== "append" && mode !== "overwrite") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  let raw;
  try {
    const buf = await file.arrayBuffer();
    raw = await parseFileBuffer(buf, file.name);
  } catch (e) {
    return NextResponse.json(
      { error: "parse_error", detail: (e as Error).message },
      { status: 400 }
    );
  }

  const result = validateRows(raw);
  if (!result.ok) {
    return NextResponse.json(
      { error: "validation_failed", errors: result.errors, valid: result.rows.length },
      { status: 400 }
    );
  }

  const store = getStore();
  if (mode === "overwrite") store.whitelist.clear();
  const now = new Date().toISOString();
  for (const r of result.rows) {
    const existing = store.whitelist.get(r.wallet);
    store.whitelist.set(r.wallet, {
      wallet: r.wallet,
      phase: r.phase,
      maxMint: r.maxMint,
      addedAt: existing?.addedAt ?? now,
    });
  }
  return NextResponse.json({
    ok: true,
    mode,
    added: result.rows.length,
    total: store.whitelist.size,
  });
}

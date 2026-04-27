import { NextResponse } from "next/server";
import { getStore, MintConfig } from "@/lib/adminStore";
import { getRound, setRound } from "@/lib/roundStore";

export const runtime = "nodejs";

export async function GET() {
  const store = getStore();
  const round = await getRound();
  return NextResponse.json({
    mint: { ...store.mintConfig },
    royalty_bps: store.mintConfig.royalty_bps,
    round_number: round.roundNumber,
  });
}

const ALLOWED_KEYS: (keyof MintConfig)[] = [
  "total_supply",
  "gtd_allocation",
  "fcfs_allocation",
  "gtd_max_mint",
  "fcfs_max_mint",
  "public_max_mint",
  "gtd_active",
  "fcfs_active",
  "public_active",
  "royalty_bps",
];

export async function PATCH(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  const store = getStore();

  for (const k of ALLOWED_KEYS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (k === "gtd_active" || k === "fcfs_active" || k === "public_active") {
      if (typeof v !== "boolean") return NextResponse.json({ error: `invalid_${k}` }, { status: 400 });
      store.mintConfig[k] = v;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: `invalid_${k}` }, { status: 400 });
      }
      if (k === "royalty_bps" && n > 10000) {
        return NextResponse.json({ error: "invalid_royalty_bps" }, { status: 400 });
      }
      store.mintConfig[k] = n;
    }
  }

  if (store.mintConfig.gtd_allocation + store.mintConfig.fcfs_allocation > store.mintConfig.total_supply) {
    return NextResponse.json({ error: "allocations_exceed_total_supply" }, { status: 400 });
  }

  // FCFS allocation is no longer used by any active flow — admin still
  // edits the field for archival reasons but it doesn't drive UI.

  // Round number lives in its own gist file (roundStore). Persist when set.
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
    ...store.mintConfig,
    ...(roundOut !== undefined ? { round_number: roundOut } : {}),
  });
}

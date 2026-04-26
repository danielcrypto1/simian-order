import { NextResponse } from "next/server";
import { getStore, MintConfig } from "@/lib/adminStore";

export const runtime = "nodejs";

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    mint: { ...store.mintConfig },
    royalty_bps: store.mintConfig.royalty_bps,
    fcfs_state: {
      total: store.fcfsState.total,
      taken: store.fcfsState.taken,
      remaining: Math.max(0, store.fcfsState.total - store.fcfsState.taken),
    },
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

  // Sanity: allocations cannot exceed total supply.
  if (store.mintConfig.gtd_allocation + store.mintConfig.fcfs_allocation > store.mintConfig.total_supply) {
    return NextResponse.json({ error: "allocations_exceed_total_supply" }, { status: 400 });
  }

  // Keep fcfs_state.total in sync with fcfs_allocation when feasible.
  if ("fcfs_allocation" in b && store.mintConfig.fcfs_allocation >= store.fcfsState.taken) {
    store.fcfsState.total = store.mintConfig.fcfs_allocation;
  }

  return NextResponse.json({ ...store.mintConfig });
}

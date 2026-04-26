import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

export async function POST() {
  const store = getStore();
  store.fcfsState.taken = 0;
  store.fcfsState.claimed.clear();
  return NextResponse.json({
    ok: true,
    total: store.fcfsState.total,
    taken: 0,
    remaining: store.fcfsState.total,
  });
}

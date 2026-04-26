import { NextResponse } from "next/server";
import { resetFcfs } from "@/lib/fcfsStore";

export const runtime = "nodejs";

export async function POST() {
  const s = await resetFcfs();
  return NextResponse.json({
    ok: true,
    total: s.total,
    taken: s.taken,
    remaining: Math.max(0, s.total - s.taken),
  });
}

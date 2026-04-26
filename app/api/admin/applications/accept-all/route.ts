import { NextResponse } from "next/server";
import { bulkSetStatusForPending } from "@/lib/applicationsStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown = {};
  try { body = await req.json(); } catch {}
  const onlyValid = (body as { onlyValid?: unknown })?.onlyValid === true;
  const count = await bulkSetStatusForPending("approved", { onlyValid });
  return NextResponse.json({ success: true, count, onlyValid });
}

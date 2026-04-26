import { NextResponse } from "next/server";
import { listApplications } from "@/lib/applicationsStore";

export const runtime = "nodejs";

export async function GET() {
  const items = await listApplications();
  return NextResponse.json({ items, total: items.length });
}

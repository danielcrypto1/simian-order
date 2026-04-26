import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    items: store.applications,
    total: store.applications.length,
  });
}

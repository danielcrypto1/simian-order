import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { wallet: string } }) {
  const wallet = params.wallet.toLowerCase();
  const store = getStore();
  const app = store.applications.find((a) => a.wallet.toLowerCase() === wallet);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  app.status = "approved";
  return NextResponse.json({ ok: true, application: app });
}

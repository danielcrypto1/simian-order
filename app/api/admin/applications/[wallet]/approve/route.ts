import { NextResponse } from "next/server";
import { setStatus } from "@/lib/applicationsStore";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { wallet: string } }) {
  const wallet = params.wallet.toLowerCase();
  const application = setStatus(wallet, "approved");
  if (!application) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, application });
}

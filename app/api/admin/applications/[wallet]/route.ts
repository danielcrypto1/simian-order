import { NextResponse } from "next/server";
import { deleteApplication } from "@/lib/applicationsStore";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { wallet: string } }
) {
  const wallet = params.wallet.toLowerCase();
  const removed = await deleteApplication(wallet);
  if (!removed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, deleted: true });
}

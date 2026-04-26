import { NextResponse } from "next/server";
import { deleteUpload } from "@/lib/uploadsStore";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { name: string } }
) {
  const removed = deleteUpload(decodeURIComponent(params.name));
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

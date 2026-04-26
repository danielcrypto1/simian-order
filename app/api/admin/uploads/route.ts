import { NextResponse } from "next/server";
import { listUploads, saveUpload, MAX_BYTES } from "@/lib/uploadsStore";

export const runtime = "nodejs";

export async function GET() {
  const items = await listUploads();
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_BYTES },
      { status: 413 }
    );
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const r = await saveUpload(file.name, buf, file.type);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, entry: r.entry });
}

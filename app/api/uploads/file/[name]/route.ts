import { NextResponse } from "next/server";
import { readFileFromStore } from "@/lib/uploadsStore";

export const runtime = "nodejs";

// Public file proxy. Used on Vercel where /tmp uploads aren't served by the
// static handler. Locally, files in public/uploads/ are served directly by
// Next.js at /uploads/<name> and this route is unused.
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  const f = readFileFromStore(decodeURIComponent(params.name));
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(f.buf, {
    headers: {
      "Content-Type": f.contentType,
      "Cache-Control": "public, max-age=600",
    },
  });
}

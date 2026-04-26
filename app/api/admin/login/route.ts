import { NextResponse } from "next/server";
import { COOKIE_NAME, checkCredentials, signAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as { username?: unknown; password?: unknown };
  if (typeof b.username !== "string" || typeof b.password !== "string") {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return NextResponse.json(
      { success: false, error: "admin_not_configured" },
      { status: 503 }
    );
  }

  if (!checkCredentials(b.username, b.password)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const token = await signAdminToken("admin");
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}

import { NextResponse } from "next/server";
import { COOKIE_NAME, signAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (
      username === process.env.ADMIN_USER &&
      password === process.env.ADMIN_PASS
    ) {
      // Sign + Set-Cookie so middleware / /api/admin/session recognise the
      // session for subsequent admin requests. The body still satisfies the
      // brief's `{ success: true }` contract.
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

    return Response.json({ success: false }, { status: 401 });
  } catch (err) {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

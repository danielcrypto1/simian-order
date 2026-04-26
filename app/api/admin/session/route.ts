import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ user: payload.sub, exp: payload.exp });
}

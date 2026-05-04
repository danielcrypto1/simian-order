import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStatusFor, newVisitorId } from "@/lib/backroomStore";

export const runtime = "nodejs";

const COOKIE = "backroom_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * GET /api/backroom
 *
 * Returns the visitor-bound status for the back room:
 *   {
 *     total:           500,
 *     remaining:       <int>,
 *     full:            <bool>,
 *     passphraseSet:   <bool>,
 *     claimed:         null | { code, claimedAt }
 *   }
 *
 * Mints + sets the `backroom_id` cookie on first visit so subsequent
 * claim attempts are bound to a stable identity. Cookie is httpOnly
 * + sameSite=lax — no JS access, no cross-site leakage.
 */
export async function GET() {
  const jar = cookies();
  let id = jar.get(COOKIE)?.value || null;
  let mint = false;
  if (!id) {
    id = newVisitorId();
    mint = true;
  }

  const s = await getStatusFor(id);

  const res = NextResponse.json({
    total: s.total,
    remaining: s.remaining,
    full: s.full,
    passphraseSet: s.passphraseSet,
    claimed: s.claimed
      ? { code: s.claimed.code, claimedAt: s.claimed.claimedAt }
      : null,
  });
  if (mint && id) {
    res.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return res;
}

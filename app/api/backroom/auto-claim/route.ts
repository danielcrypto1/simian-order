import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  codeToSlug,
  grantAutoCode,
  hashIp,
  newVisitorId,
  rateLimitOk,
} from "@/lib/backroomStore";

export const runtime = "nodejs";

const COOKIE = "backroom_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function clientIp(): string {
  const h = headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * POST /api/backroom/auto-claim
 *
 * Issues the next sequential ORDER #N to the calling visitor (cookie-
 * bound, idempotent — same cookie always gets back the same claim).
 * No passphrase, no wallet — verification of "who owns this code"
 * happens downstream in our Discord ticket flow.
 *
 * Side effects:
 *   - mints the backroom_id httpOnly cookie if missing
 *   - rate-limits per IP (8 / 60s) against burst spam
 *
 * Response shapes:
 *   200 { ok: true,  full: false, code: "ORDER #N", index, slug, claimedAt, remaining, total }
 *   200 { ok: false, full: true,  total: 500, remaining: 0 }       // cap reached
 *   429 { ok: false, error: "rate_limited" }
 *   500 { ok: false, error: "internal_error" }
 */
export async function POST() {
  const ip = clientIp();
  const ipHash = hashIp(ip);
  if (!rateLimitOk(ipHash)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const jar = cookies();
  let id = jar.get(COOKIE)?.value || null;
  let mint = false;
  if (!id) {
    id = newVisitorId();
    mint = true;
  }

  const result = await grantAutoCode({ visitorId: id, ipHash });

  function setMintedCookie(res: NextResponse): NextResponse {
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

  if (!result.ok) {
    if (result.error === "full") {
      return setMintedCookie(
        NextResponse.json({ ok: false, full: true, total: 500, remaining: 0 })
      );
    }
    return setMintedCookie(
      NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    );
  }

  return setMintedCookie(
    NextResponse.json({
      ok: true,
      full: false,
      code: result.claim.code,
      index: result.claim.index,
      slug: codeToSlug(result.claim.code),
      claimedAt: result.claim.claimedAt,
      remaining: result.remaining,
      total: 500,
    })
  );
}

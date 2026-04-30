import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  claimCode,
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
 * POST /api/backroom/claim
 * body: { code: string }   // the user-typed passphrase
 *
 * Side effects:
 *   - mints the backroom_id cookie if missing
 *   - rate-limits per IP (8 / 60s) against burst spam
 *   - on a correct passphrase + space remaining + first claim for
 *     this cookie, generates a unique XXXX-XXXX code and stores
 *     it server-side
 *
 * Response shapes:
 *   200 { ok: true, code: "XXXX-XXXX", claimedAt, remaining, total }
 *   400 { ok: false, error: "wrong_code" | "no_passphrase_set" }
 *   403 { ok: false, error: "full" }
 *   429 { ok: false, error: "rate_limited" }
 *   500 { ok: false, error: "internal_error" }
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const attempt = typeof (body as any)?.code === "string" ? (body as any).code : "";
  if (!attempt || attempt.length > 128) {
    return NextResponse.json({ ok: false, error: "wrong_code" }, { status: 400 });
  }

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

  const result = await claimCode({ visitorId: id, ipHash, attempt });

  if (!result.ok) {
    const status =
      result.error === "full" ? 403 :
      result.error === "rate_limited" ? 429 :
      result.error === "internal_error" ? 500 :
      400;
    const res = NextResponse.json(result, { status });
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

  const res = NextResponse.json({
    ok: true,
    code: result.claim.code,
    claimedAt: result.claim.claimedAt,
    remaining: result.remaining,
    total: 500,
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

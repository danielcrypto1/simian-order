import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { grantFcfsForWallet } from "@/lib/backroomStore";
import { walletExistsElsewhere } from "@/lib/walletRegistry";
import { makeBucket, clientIp, hashIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

// Same shape as the back-room rate limiter: 8 attempts / 60s per IP.
// Combined with the wallet-uniqueness checks below this kills bot
// floods without inconveniencing legitimate users.
const grantBucket = makeBucket({ windowMs: 60_000, max: 8 });

/**
 * POST /api/fcfs/grant
 * body: { wallet: string }
 *
 * Auto-grants an FCFS slot to a wallet that has completed every task
 * on /dashboard/tasks. The tasks UI fires this once per session after
 * the user finishes the quest log AND submits their identity.
 *
 * Validation:
 *   - wallet format (0x + 40 hex)
 *   - rate limit (8 per IP per 60s)
 *   - cross-system uniqueness — wallets already filed in HIGH ORDER
 *     applications or named on a SUMMONING entry are rejected so the
 *     OpenSea export sets stay disjoint
 *
 * Storage shares the same `backroom.json` gist file as the back-room
 * passphrase flow — same 500 cap, same shared drop code. Only the
 * `source: "quest"` tag distinguishes these in the admin claims table.
 *
 * Response shapes:
 *   200 { ok: true, code, wallet, claimedAt, remaining, total, source: "quest" }
 *   400 { ok: false, error: "invalid_wallet" | "missing_wallet" }
 *   403 { ok: false, error: "full" }
 *   409 { ok: false, error: "wallet_in_use", details: [...] }
 *   429 { ok: false, error: "rate_limited" }
 *   500 { ok: false, error: "internal_error" }
 */
export async function POST(req: Request) {
  const ip = clientIp(headers());
  const ipHash = hashIp(ip);
  if (!grantBucket.ok(ipHash)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const wallet = typeof (body as any)?.wallet === "string" ? (body as any).wallet : "";
  if (!wallet) {
    return NextResponse.json({ ok: false, error: "missing_wallet" }, { status: 400 });
  }
  if (!WALLET_RE.test(wallet)) {
    return NextResponse.json({ ok: false, error: "invalid_wallet" }, { status: 400 });
  }
  const w = wallet.toLowerCase();

  // Cross-system uniqueness — same rule as /api/backroom/claim. A
  // wallet already on a HIGH ORDER application or a SUMMONING entry
  // can't also take an FCFS slot.
  const conflict = await walletExistsElsewhere(w, "backroom_claim");
  if (conflict.exists) {
    return NextResponse.json(
      { ok: false, error: "wallet_in_use", details: conflict.hits },
      { status: 409 }
    );
  }

  const result = await grantFcfsForWallet({ wallet: w, ipHash });
  if (!result.ok) {
    const status =
      result.error === "full" ? 403 :
      result.error === "internal_error" ? 500 :
      400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json({
    ok: true,
    code: result.claim.code,
    wallet: result.claim.wallet,
    claimedAt: result.claim.claimedAt,
    remaining: result.remaining,
    total: 500,
    source: "quest" as const,
  });
}

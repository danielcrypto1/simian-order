import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { grantFcfsForWallet } from "@/lib/backroomStore";
import { makeBucket, clientIp, hashIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

// 8 attempts / 60s per IP — keeps bot floods off the FCFS list without
// inconveniencing legitimate users.
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
 *
 * Any wallet may claim — including wallets already on a HIGH ORDER
 * application or named on a SUMMONING entry. The cross-system
 * uniqueness check was removed so anyone who finishes the quests
 * gets a slot.
 *
 * Storage shares the same `backroom.json` gist file as the back-room
 * auto-claim flow — same 500 cap, same sequential ORDER #N counter.
 * Only the `source: "quest"` tag distinguishes these in the admin
 * claims table.
 *
 * Response shapes:
 *   200 { ok: true, code, wallet, claimedAt, remaining, total, source: "quest" }
 *   400 { ok: false, error: "invalid_wallet" | "missing_wallet" }
 *   403 { ok: false, error: "full" }
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

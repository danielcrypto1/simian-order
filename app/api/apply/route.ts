import { NextResponse } from "next/server";
import { upsertApplication } from "@/lib/applicationsStore";
import { addReferral, findLinkByCode } from "@/lib/referralsStore";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as {
    wallet?: unknown; handle?: unknown; discord?: unknown;
    why?: unknown; referrer_input?: unknown; twitter?: unknown;
    source?: unknown;
  };

  if (typeof b.wallet !== "string" || !isWallet(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const twitterRaw = typeof b.twitter === "string" && b.twitter
    ? b.twitter
    : typeof b.handle === "string" ? b.handle : "";
  const twitter = twitterRaw.toString().replace(/^@+/, "").trim();
  if (twitter.length < 1 || twitter.length > 64) {
    return NextResponse.json({ error: "invalid_twitter" }, { status: 400 });
  }
  if (b.why !== undefined && typeof b.why !== "string") {
    return NextResponse.json({ error: "invalid_why" }, { status: 400 });
  }

  const wallet = b.wallet.toLowerCase();
  const why = typeof b.why === "string" && b.why.trim() ? b.why.trim() : null;
  const discord = typeof b.discord === "string" && b.discord.trim()
    ? b.discord.trim().slice(0, 64)
    : null;
  const referrerInput =
    typeof b.referrer_input === "string" && b.referrer_input.trim().length > 0
      ? b.referrer_input.trim().toUpperCase()
      : null;

  // Source: "apply" by default. Quest auto-submission from the tasks
  // page passes source="quest" so admin can filter on it. Anything else
  // is rejected so the field can never be smuggled.
  const source: "apply" | "quest" =
    b.source === "quest" ? "quest" : "apply";

  // ALWAYS pending on a formal apply submission. Quest submissions
  // preserve any existing admin decision (handled inside upsertApplication).
  const application = await upsertApplication({
    wallet,
    twitter,
    why,
    discord,
    referrer_input: referrerInput,
    source,
  });

  // Referral linkage (best-effort, doesn't block application creation).
  let referralResult: { ok: boolean; error?: string } | null = null;
  if (referrerInput) {
    const link = await findLinkByCode(referrerInput);
    if (link) {
      const r = await addReferral(link.wallet, wallet);
      referralResult = r.ok ? { ok: true } : { ok: false, error: r.error };
    } else {
      referralResult = { ok: false, error: "code_not_found" };
    }
  }

  return NextResponse.json({ ok: true, application, referral: referralResult });
}

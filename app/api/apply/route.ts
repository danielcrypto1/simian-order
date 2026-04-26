import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
import { upsertApplication } from "@/lib/applicationsStore";
import { codeForWallet } from "@/lib/referralCode";

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
  };

  if (typeof b.wallet !== "string" || !isWallet(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  // Accept both `handle` and `twitter` as the X username field.
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

  // ALWAYS pending. Submission never auto-approves.
  const application = await upsertApplication({
    wallet,
    twitter,
    why,
    discord,
    referrer_input: referrerInput,
  });

  // Optional referral linkage (still in-memory — not strictly tied to apps).
  if (referrerInput) {
    const store = getStore();
    let linked = false;
    for (const [refWallet, link] of store.referrals.entries()) {
      if (link.code === referrerInput && refWallet !== wallet) {
        if (!link.referred.includes(wallet)) link.referred.push(wallet);
        linked = true;
        break;
      }
    }
    if (!linked) {
      const { listApplications } = await import("@/lib/applicationsStore");
      const allApps = await listApplications();
      for (const app of allApps) {
        const code = codeForWallet(app.wallet);
        if (code === referrerInput && app.wallet !== wallet) {
          const existing = store.referrals.get(app.wallet);
          if (existing) {
            if (!existing.referred.includes(wallet)) existing.referred.push(wallet);
          } else {
            store.referrals.set(app.wallet, {
              wallet: app.wallet,
              code,
              referred: [wallet],
            });
          }
          break;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, application });
}

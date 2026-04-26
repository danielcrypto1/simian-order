import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
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
    why?: unknown; referrer_input?: unknown;
  };

  if (typeof b.wallet !== "string" || !isWallet(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  if (typeof b.handle !== "string" || b.handle.trim().length < 1 || b.handle.length > 64) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }
  if (typeof b.why !== "string" || b.why.trim().length < 1 || b.why.length > 2000) {
    return NextResponse.json({ error: "invalid_why" }, { status: 400 });
  }
  const wallet = b.wallet.toLowerCase();
  const handle = b.handle.trim();
  const discord = typeof b.discord === "string" ? b.discord.trim().slice(0, 64) : null;
  const why = b.why.trim();
  const referrerInput =
    typeof b.referrer_input === "string" && b.referrer_input.trim().length > 0
      ? b.referrer_input.trim().toUpperCase()
      : null;

  const store = getStore();

  // One pending app per wallet — replace if pending.
  const idx = store.applications.findIndex((a) => a.wallet.toLowerCase() === wallet);
  const application = {
    wallet,
    handle,
    twitter: handle.startsWith("@") ? handle.slice(1) : handle,
    status: "pending" as const,
    submittedAt: new Date().toISOString(),
  };
  if (idx >= 0) store.applications[idx] = application;
  else store.applications.unshift(application);

  // Record referrer linkage if the input matches a known wallet's code.
  if (referrerInput) {
    for (const [refWallet, link] of store.referrals.entries()) {
      if (link.code === referrerInput && refWallet !== wallet) {
        if (!link.referred.includes(wallet)) link.referred.push(wallet);
        break;
      }
    }
    // Also create-on-redeem: scan all wallets and find one whose deterministic
    // code matches the input (the referrer doesn't have to have viewed their
    // referral page first).
    if (![...store.referrals.values()].some((l) => l.code === referrerInput)) {
      // Brute force across applicants only — bounded set.
      for (const app of store.applications) {
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

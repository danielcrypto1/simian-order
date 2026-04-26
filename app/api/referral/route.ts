import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
import { codeForWallet, REFERRAL_LIMIT } from "@/lib/referralCode";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("wallet");
  if (!raw || !isWallet(raw)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const wallet = raw.toLowerCase();
  const code = codeForWallet(wallet);

  const store = getStore();
  let link = store.referrals.get(wallet);
  if (!link) {
    link = { wallet, code, referred: [] };
    store.referrals.set(wallet, link);
  } else if (link.code !== code) {
    link.code = code;
  }

  // Hydrate referred list with current application status.
  const referred = link.referred.map((w) => {
    const app = store.applications.find((a) => a.wallet.toLowerCase() === w);
    return {
      wallet: w,
      handle: app?.handle ?? null,
      status: app?.status ?? "pending",
      submittedAt: app?.submittedAt ?? null,
    };
  });

  return NextResponse.json({
    wallet,
    code,
    count: referred.length,
    limit: REFERRAL_LIMIT,
    referred,
  });
}

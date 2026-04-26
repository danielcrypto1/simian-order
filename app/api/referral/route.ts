import { NextResponse } from "next/server";
import { getStore } from "@/lib/adminStore";
import { listApplications } from "@/lib/applicationsStore";
import { codeForWallet, REFERRAL_LIMIT } from "@/lib/referralCode";

export const runtime = "nodejs";

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export async function GET(req: Request) {
  // GET handler is already async, no change needed for await.
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

  // Hydrate referred list with current application status from the store.
  const apps = await listApplications();
  const referred = link.referred.map((w) => {
    const app = apps.find((a) => a.wallet.toLowerCase() === w);
    return {
      wallet: w,
      handle: app?.twitter ? "@" + app.twitter : null,
      status: app?.status ?? "pending",
      submittedAt: app?.createdAt ?? null,
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

import { NextResponse } from "next/server";
import { getOrCreateLink, REFERRAL_LIMIT } from "@/lib/referralsStore";
import { listApplications } from "@/lib/applicationsStore";

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

  const link = await getOrCreateLink(wallet);
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
    code: link.code,
    count: referred.length,
    limit: REFERRAL_LIMIT,
    referred,
  });
}

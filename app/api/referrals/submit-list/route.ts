import { NextResponse } from "next/server";
import {
  upsertSubmission,
  MAX_ENTRIES,
  type SubmitError,
} from "@/lib/submissionsStore";
import { walletExistsElsewhere } from "@/lib/walletRegistry";
import { findByWallet } from "@/lib/applicationsStore";

export const runtime = "nodejs";

/**
 * Curated submission entry-point.
 *
 *   POST /api/referrals/submit-list
 *   body: { wallet, entries: [{ x, discord, wallet }, ...] }   (1..5)
 *   →  200 { ok: true, submission }
 *      400 / 403 / 409 / 500 { error: <SubmitError> }
 *
 * The referrer must be application-approved (validated inside
 * upsertSubmission via lib/applicationsStore.findByWallet). Re-
 * submission is allowed only while every existing entry is still
 * pending — once admin decides any entry, the submission locks.
 *
 * Status mapping:
 *   not_approved              → 403  (formal apply not approved yet)
 *   submission_locked         → 409  (admin already touched entries)
 *   already_submitted_by_other→ 409  (referee wallet claimed elsewhere)
 *   write_failed              → 500  (gist PATCH error)
 *   anything else (validation)→ 400
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { wallet?: unknown; entries?: unknown };

  if (typeof b.wallet !== "string") {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
  }
  if (!Array.isArray(b.entries)) {
    return NextResponse.json({ error: "missing_entries" }, { status: 400 });
  }

  // Cross-system uniqueness on each entry wallet — block any wallet
  // that's already a HIGH ORDER applicant (other than the referrer
  // themselves, who's expected to be an applicant) or a BACK ROOM
  // claimant. The submissionsStore already enforces uniqueness within
  // its own system; this guards the cross-system overlap.
  const entries = b.entries.slice(0, MAX_ENTRIES) as Array<{
    x: string; discord: string; wallet: string;
  }>;
  for (const e of entries) {
    if (typeof e?.wallet !== "string") continue;
    const w = e.wallet.toLowerCase().trim();
    if (!w) continue;
    // An entry wallet that's already filed an application would end
    // up on TWO export lists if approved. Reject here.
    const existingApp = await findByWallet(w);
    if (existingApp) {
      return NextResponse.json(
        { error: "wallet_in_use", details: ["application"], wallet: w },
        { status: 409 }
      );
    }
    const conflict = await walletExistsElsewhere(w, "summoning_entry");
    if (conflict.exists) {
      return NextResponse.json(
        { error: "wallet_in_use", details: conflict.hits, wallet: w },
        { status: 409 }
      );
    }
  }

  const r = await upsertSubmission({
    referrerWallet: b.wallet,
    entries,
  });

  if (r.ok) return NextResponse.json({ ok: true, submission: r.submission });

  const code = statusFor(r.error);
  return NextResponse.json({ error: r.error }, { status: code });
}

function statusFor(err: SubmitError): number {
  switch (err) {
    case "not_approved": return 403;
    case "submission_locked":
    case "already_submitted_by_other": return 409;
    case "write_failed": return 500;
    default: return 400;
  }
}

import { readJSON, writeJSON } from "./gistStore";
import { getRound } from "./roundStore";
import { findByWallet } from "./applicationsStore";

/**
 * Curated submission store. Replaces the old auto-tracked referral
 * link system. Approved users submit up to 5 candidate entries
 * (X handle / Discord / wallet); admin reviews each entry one by
 * one and approves or rejects. Approved entries earn GTD/eligibility.
 *
 * Storage: one Submission per referrer wallet. Subsequent calls APPEND
 * new entries into the remaining slots (cap MAX_ENTRIES total) without
 * touching anything that's already there — decided entries stay
 * decided, pending entries stay pending. Admin still owns the kill
 * switch via Reset Data if they need a clean re-entry.
 *
 * Validation enforces:
 *   - referrer must be application-approved at submit time
 *   - 1..5 entries, each with non-empty x, discord, valid wallet
 *   - no self-referral (entry wallet !== referrer wallet)
 *   - no duplicate wallet within the same submission
 *   - no global collision: entry wallet not already submitted by a
 *     DIFFERENT referrer with status !== "rejected" (rejection
 *     releases the wallet for re-submission by someone else)
 */

const FILE = "submissions.json";

export const MAX_ENTRIES = 5;

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type SubmissionEntry = {
  x: string;          // X / twitter handle, no leading @
  discord: string;    // discord username
  wallet: string;     // ape-chain wallet, lowercased
  status: SubmissionStatus;
  decidedAt?: string; // ISO timestamp when admin acted
};

export type Submission = {
  referrerWallet: string;     // who submitted (always lowercased)
  referrerRound: number;      // round at first submission time
  entries: SubmissionEntry[]; // 1..MAX_ENTRIES
  createdAt: string;          // first submission time
  updatedAt: string;          // any state change (decision or resubmit)
};

export type SubmitInput = {
  referrerWallet: string;
  entries: Array<{ x: string; discord: string; wallet: string }>;
};

export type SubmitError =
  | "invalid_referrer"
  | "not_approved"
  | "no_entries"
  | "too_many"
  | "invalid_wallet"
  | "self_referral"
  | "duplicate_wallet"
  | "invalid_x"
  | "invalid_discord"
  | "already_submitted_by_other"
  | "no_slots_remaining"
  | "write_failed";

export type SubmitResult =
  | { ok: true; submission: Submission }
  | { ok: false; error: SubmitError };

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

async function read(): Promise<Submission[]> {
  const raw = await readJSON<Submission[]>(FILE, []);
  return Array.isArray(raw) ? raw : [];
}

async function write(items: Submission[]): Promise<void> {
  await writeJSON(FILE, items);
}

/** Public read: a single referrer's submission (or null). */
export async function getSubmission(referrerWallet: string): Promise<Submission | null> {
  const w = referrerWallet.toLowerCase();
  const all = await read();
  return all.find((s) => s.referrerWallet === w) ?? null;
}

/** Admin read: every submission, newest activity first. */
export async function listSubmissions(): Promise<Submission[]> {
  const all = await read();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Submit a list of entries. Behaves as append-only:
 *
 *   - no existing submission for this wallet → creates one with the
 *     provided entries (1..MAX_ENTRIES).
 *   - existing submission → preserves every existing entry as-is
 *     (decided + pending alike) and appends the new entries into the
 *     remaining slots. The combined total still has to be
 *     ≤ MAX_ENTRIES; if there's no room left we return
 *     `no_slots_remaining`.
 *
 * The user can never modify or replace an entry they already filed —
 * admin is the only one who can wipe a submission (via Reset Data) if
 * a fresh start is needed.
 */
export async function upsertSubmission(input: SubmitInput): Promise<SubmitResult> {
  const wallet = input.referrerWallet.toLowerCase().trim();
  if (!isWallet(wallet)) return { ok: false, error: "invalid_referrer" };

  // Gate: referrer must be approved by admin.
  const app = await findByWallet(wallet);
  if (!app || app.status !== "approved") {
    return { ok: false, error: "not_approved" };
  }

  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    return { ok: false, error: "no_entries" };
  }
  if (input.entries.length > MAX_ENTRIES) {
    return { ok: false, error: "too_many" };
  }

  const all = await read();
  const idx = all.findIndex((s) => s.referrerWallet === wallet);
  const existingEntries = idx >= 0 ? all[idx].entries : [];
  const remainingSlots = MAX_ENTRIES - existingEntries.length;
  if (remainingSlots <= 0) {
    return { ok: false, error: "no_slots_remaining" };
  }
  if (input.entries.length > remainingSlots) {
    return { ok: false, error: "no_slots_remaining" };
  }

  // Per-entry validation + dedupe within the new batch AND against
  // wallets the user already has in this submission.
  const cleanEntries: SubmissionEntry[] = [];
  const seenInBatch = new Set<string>();
  const existingWallets = new Set(existingEntries.map((e) => e.wallet));
  for (const e of input.entries) {
    const ew = String(e?.wallet ?? "").toLowerCase().trim();
    if (!isWallet(ew)) return { ok: false, error: "invalid_wallet" };
    if (ew === wallet) return { ok: false, error: "self_referral" };
    if (seenInBatch.has(ew) || existingWallets.has(ew)) {
      return { ok: false, error: "duplicate_wallet" };
    }
    seenInBatch.add(ew);

    const x = String(e?.x ?? "").trim().replace(/^@+/, "");
    if (x.length < 1 || x.length > 64) return { ok: false, error: "invalid_x" };

    const d = String(e?.discord ?? "").trim();
    if (d.length < 1 || d.length > 64) return { ok: false, error: "invalid_discord" };

    cleanEntries.push({ x, discord: d, wallet: ew, status: "pending" });
  }

  // Global wallet collision check — a referee wallet can only be
  // active in one submission at a time. Rejected entries release the
  // wallet for someone else to submit.
  for (const e of cleanEntries) {
    for (const existing of all) {
      if (existing.referrerWallet === wallet) continue;
      if (
        existing.entries.some(
          (x) => x.wallet === e.wallet && x.status !== "rejected"
        )
      ) {
        return { ok: false, error: "already_submitted_by_other" };
      }
    }
  }

  const now = new Date().toISOString();
  const round = (await getRound()).roundNumber;

  const submission: Submission = {
    referrerWallet: wallet,
    referrerRound: idx >= 0 ? all[idx].referrerRound : round,
    entries: [...existingEntries, ...cleanEntries],
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
  };

  if (idx >= 0) all[idx] = submission;
  else all.push(submission);

  try {
    await write(all);
  } catch {
    return { ok: false, error: "write_failed" };
  }
  return { ok: true, submission };
}

/**
 * Admin: set the status of a single entry. Returns the updated
 * submission, or null if either the referrer or the entry wasn't
 * found.
 */
export async function setEntryStatus(
  referrerWallet: string,
  refereeWallet: string,
  status: "approved" | "rejected"
): Promise<Submission | null> {
  const r = referrerWallet.toLowerCase();
  const e = refereeWallet.toLowerCase();
  const all = await read();
  const sub = all.find((s) => s.referrerWallet === r);
  if (!sub) return null;
  const entry = sub.entries.find((x) => x.wallet === e);
  if (!entry) return null;
  entry.status = status;
  entry.decidedAt = new Date().toISOString();
  sub.updatedAt = entry.decidedAt;
  await write(all);
  return sub;
}

/** Admin: derive the GTD wallet list — every approved entry across
 *  every submission. */
export async function listGtdWallets(): Promise<string[]> {
  const all = await read();
  const out = new Set<string>();
  for (const sub of all) {
    for (const e of sub.entries) {
      if (e.status === "approved") out.add(e.wallet);
    }
  }
  return Array.from(out);
}

/** Admin: full wipe (used by /api/admin/reset). Returns the count
 *  of submissions removed. */
export async function clearAllSubmissions(): Promise<number> {
  const before = await read();
  await write([]);
  return before.length;
}

/** Admin: delete a single submission so the user can resubmit. */
export async function deleteSubmission(referrerWallet: string): Promise<boolean> {
  const w = referrerWallet.toLowerCase();
  const all = await read();
  const idx = all.findIndex((s) => s.referrerWallet === w);
  if (idx < 0) return false;
  all.splice(idx, 1);
  await write(all);
  return true;
}

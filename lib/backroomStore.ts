import crypto from "node:crypto";
import { readJSON, writeJSON } from "./gistStore";
import {
  BACKROOM_TOTAL as TOTAL,
  formatOrderCode,
  orderSlug,
  parseOrderSlug,
} from "./orderCodes";

// Re-export the pure helpers + constant so existing
// `from "@/lib/backroomStore"` imports keep working.
export { formatOrderCode, orderSlug, parseOrderSlug };

/**
 * Back Room — a hidden 500-claim easter egg surface gated by a
 * passphrase. The admin sets the passphrase; visitors who type it
 * correctly receive a UNIQUE sequential code: "ORDER #1", "ORDER #2",
 * ..., "ORDER #500". The user submits this code in our Discord ticket
 * to receive the HIGH ORDER role. Each browser identity gets ONE
 * claim. Once 500 claims are issued, /backroom returns "ACCESS CLOSED".
 *
 * Storage: a single gist file (`backroom.json`) holds the active
 * passphrase, the cap, and the array of claims. Claims store the
 * issued code, the visitor cookie ID that minted it, and the
 * timestamp so admin can audit. The IP is stored as a short hash
 * (not the raw value) so the panel can group abuse without leaking
 * PII.
 *
 * Code numbering: index = claims.length + 1 at claim time. Legacy
 * claims that hold older non-sequential codes are preserved as-is
 * — they still count toward the 500 cap. New claims after the
 * sequential rollout pick up the next free index regardless of
 * whether earlier claim records had ORDER-style codes.
 */

const FILE = "backroom.json";

export const BACKROOM_TOTAL = TOTAL;

/**
 * Where a claim came in from.
 *   "passphrase" — visitor typed the back-room passphrase at /backroom
 *   "quest"      — wallet completed all tasks at /dashboard/tasks and
 *                  was auto-granted an FCFS slot (no passphrase)
 *
 * Same 500 cap, same shared drop code, same CSV export — just an
 * audit field so admin can see how each wallet got in.
 */
export type ClaimSource = "passphrase" | "quest";

export type BackroomClaim = {
  code: string;        // "ORDER #N" — unique sequential code; legacy claims may hold older non-sequential strings
  index: number;       // 1-based position in the claim sequence (matches the N in "ORDER #N" for new claims)
  wallet: string;      // ape-chain wallet (lowercased) — bound to this code for mint eligibility
  visitorId: string;   // cookie id (uuid v4 minted server-side)
  ipHash: string;      // short sha256 prefix of the request IP
  source: ClaimSource; // how this claim entered the system
  claimedAt: string;   // ISO
};

export type BackroomState = {
  passphrase: string | null; // null until admin sets it
  total: number;             // hard cap (500)
  claims: BackroomClaim[];
  updatedAt: string;
};

const DEFAULT: BackroomState = {
  passphrase: null,
  total: BACKROOM_TOTAL,
  claims: [],
  updatedAt: new Date().toISOString(),
};

async function read(): Promise<BackroomState> {
  const s = await readJSON<BackroomState>(FILE, DEFAULT);
  // Force the cap to the constant — admin shouldn't be able to drift
  // it via direct gist edit. Backfill per-claim source + index for
  // legacy state files written before those fields existed; index is
  // derived from array order so legacy claims slot into the sequence
  // even if their `code` field doesn't follow the ORDER #N format.
  const rawClaims = Array.isArray(s.claims) ? s.claims : [];
  return {
    ...s,
    total: BACKROOM_TOTAL,
    claims: rawClaims.map((c, i) => ({
      ...c,
      source: (c as BackroomClaim).source === "quest" ? "quest" : "passphrase",
      index: typeof (c as BackroomClaim).index === "number" ? (c as BackroomClaim).index : i + 1,
    })),
  };
}

async function write(s: BackroomState): Promise<void> {
  await writeJSON(FILE, { ...s, total: BACKROOM_TOTAL, updatedAt: new Date().toISOString() });
}

// ── ID + code helpers ────────────────────────────────────────────────

export function newVisitorId(): string {
  // Avoid relying on crypto.randomUUID, which exists on Node 18+ but
  // some older lambda runtimes may not expose it. Fall back to
  // randomBytes-based UUID v4.
  if (typeof (crypto as any).randomUUID === "function") {
    return (crypto as any).randomUUID();
  }
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}


export function hashIp(ip: string | null | undefined): string {
  if (!ip) return "anon";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

// ── Public lookups ───────────────────────────────────────────────────

export async function getStatusFor(visitorId: string | null): Promise<{
  total: number;
  remaining: number;
  full: boolean;
  passphraseSet: boolean;
  claimed: BackroomClaim | null;
}> {
  const s = await read();
  const claimed =
    visitorId ? s.claims.find((c) => c.visitorId === visitorId) ?? null : null;
  return {
    total: s.total,
    remaining: Math.max(0, s.total - s.claims.length),
    full: s.claims.length >= s.total,
    passphraseSet: !!s.passphrase && s.passphrase.trim().length > 0,
    claimed,
  };
}

export type ClaimResult =
  | { ok: true; claim: BackroomClaim; remaining: number }
  | {
      ok: false;
      error:
        | "no_passphrase_set"
        | "wrong_code"
        | "full"
        | "missing_visitor"
        | "missing_wallet"
        | "invalid_wallet"
        | "wallet_already_claimed"
        | "rate_limited"
        | "internal_error";
    };

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export async function claimCode(opts: {
  visitorId: string;
  ipHash: string;
  attempt: string;
  wallet: string;
}): Promise<ClaimResult> {
  const { visitorId, ipHash, attempt } = opts;
  if (!visitorId) return { ok: false, error: "missing_visitor" };

  // Wallet is required and must look like an ape-chain (0x + 40 hex) address.
  // Stored lowercased so admin lookups + dedupe checks are case-insensitive.
  const walletRaw = (opts.wallet || "").trim();
  if (!walletRaw) return { ok: false, error: "missing_wallet" };
  if (!WALLET_RE.test(walletRaw)) return { ok: false, error: "invalid_wallet" };
  const wallet = walletRaw.toLowerCase();

  const s = await read();
  if (!s.passphrase || !s.passphrase.trim()) {
    return { ok: false, error: "no_passphrase_set" };
  }

  // If this visitor already claimed, return the existing claim instead
  // of issuing a new one — idempotent re-submission with the right code.
  const existing = s.claims.find((c) => c.visitorId === visitorId);
  if (existing) {
    return {
      ok: true,
      claim: existing,
      remaining: Math.max(0, s.total - s.claims.length),
    };
  }

  // Block duplicate claims on the same wallet from a different visitor —
  // mint eligibility is bound to the wallet, so one wallet = one code.
  const walletTaken = s.claims.find((c) => c.wallet === wallet);
  if (walletTaken) return { ok: false, error: "wallet_already_claimed" };

  const expected = s.passphrase.trim().toLowerCase();
  const got = (attempt || "").trim().toLowerCase();
  if (got !== expected) return { ok: false, error: "wrong_code" };

  if (s.claims.length >= s.total) return { ok: false, error: "full" };

  // Re-read to minimise the race window between the cap check and the
  // write. Last-write-wins on the gist is acceptable for an easter
  // egg — at worst the cap is exceeded by a tiny margin under burst.
  const fresh = await read();
  if (fresh.claims.some((c) => c.visitorId === visitorId)) {
    const dup = fresh.claims.find((c) => c.visitorId === visitorId)!;
    return { ok: true, claim: dup, remaining: Math.max(0, fresh.total - fresh.claims.length) };
  }
  if (fresh.claims.some((c) => c.wallet === wallet)) {
    return { ok: false, error: "wallet_already_claimed" };
  }
  if (fresh.claims.length >= fresh.total) return { ok: false, error: "full" };

  // Sequential code: this claim's index is 1 + count of existing claims,
  // so each visitor gets a unique "ORDER #N" pulled from the same 500
  // pool. Legacy non-sequential claim records still occupy positions in
  // the array, so the index naturally skips past them.
  const index = fresh.claims.length + 1;
  const claim: BackroomClaim = {
    code: formatOrderCode(index),
    index,
    wallet,
    visitorId,
    ipHash,
    source: "passphrase",
    claimedAt: new Date().toISOString(),
  };
  fresh.claims.push(claim);
  await write(fresh);
  return {
    ok: true,
    claim,
    remaining: Math.max(0, fresh.total - fresh.claims.length),
  };
}

export type GrantResult =
  | { ok: true; claim: BackroomClaim; remaining: number }
  | {
      ok: false;
      error:
        | "missing_wallet"
        | "invalid_wallet"
        | "wallet_already_claimed"
        | "full"
        | "internal_error";
    };

/**
 * Grant an FCFS slot to a wallet WITHOUT requiring the back-room
 * passphrase. Used by the tasks-completion auto-claim flow at
 * /dashboard/tasks: when a visitor finishes all tasks AND submits
 * their identity, the server books them a slot here.
 *
 * Same 500 cap, same shared drop code, same idempotency rules as
 * `claimCode` — the only difference is the source tag and skipping
 * the passphrase check.
 */
export async function grantFcfsForWallet(opts: {
  wallet: string;
  ipHash: string;
}): Promise<GrantResult> {
  const walletRaw = (opts.wallet || "").trim();
  if (!walletRaw) return { ok: false, error: "missing_wallet" };
  if (!WALLET_RE.test(walletRaw)) return { ok: false, error: "invalid_wallet" };
  const wallet = walletRaw.toLowerCase();

  const s = await read();

  // Idempotent: if this wallet is already in the FCFS pool, return
  // the existing claim — the user can re-fetch the code as many
  // times as they want.
  const existing = s.claims.find((c) => c.wallet === wallet);
  if (existing) {
    return {
      ok: true,
      claim: existing,
      remaining: Math.max(0, s.total - s.claims.length),
    };
  }

  if (s.claims.length >= s.total) return { ok: false, error: "full" };

  const fresh = await read();
  if (fresh.claims.some((c) => c.wallet === wallet)) {
    const dup = fresh.claims.find((c) => c.wallet === wallet)!;
    return { ok: true, claim: dup, remaining: Math.max(0, fresh.total - fresh.claims.length) };
  }
  if (fresh.claims.length >= fresh.total) return { ok: false, error: "full" };

  // Quest grants share the same sequential numbering as passphrase
  // claims — single 500 pool, one counter.
  const index = fresh.claims.length + 1;
  const claim: BackroomClaim = {
    code: formatOrderCode(index),
    index,
    wallet,
    // Quest grants don't have a back-room cookie; mint a synthetic
    // visitorId so the storage shape stays uniform and admin lookups
    // by visitorId still work.
    visitorId: `quest-${newVisitorId()}`,
    ipHash: opts.ipHash,
    source: "quest",
    claimedAt: new Date().toISOString(),
  };
  fresh.claims.push(claim);
  await write(fresh);
  return {
    ok: true,
    claim,
    remaining: Math.max(0, fresh.total - fresh.claims.length),
  };
}

// ── Admin ────────────────────────────────────────────────────────────

export async function adminGetState(): Promise<BackroomState> {
  return read();
}

export async function adminSetPassphrase(passphrase: string): Promise<void> {
  const s = await read();
  s.passphrase = passphrase.trim();
  await write(s);
}

/**
 * Wipe all claims. Resets the sequential counter to 0 (next claim
 * becomes ORDER #1). Passphrase is preserved unless
 * `alsoClearPassphrase` is set.
 */
export async function adminResetClaims(opts?: {
  alsoClearPassphrase?: boolean;
}): Promise<void> {
  const s = await read();
  s.claims = [];
  if (opts?.alsoClearPassphrase) {
    s.passphrase = null;
  }
  await write(s);
}

// ── Spam-protection: in-memory IP rate limiter ──────────────────────
// Per-process bucket. On Vercel each lambda instance has its own
// counter — combined with the cookie-bound idempotency check above,
// this keeps the abuse surface small without needing Redis. Window
// rolls every 60s, max 8 attempts per IP per window.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const rateState = new Map<string, { count: number; resetAt: number }>();

export function rateLimitOk(ipHash: string): boolean {
  const now = Date.now();
  const cur = rateState.get(ipHash);
  if (!cur || cur.resetAt < now) {
    rateState.set(ipHash, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

// ── Reset test helper used by /api/admin/reset ───────────────────────

export async function clearAllBackroom(): Promise<{ claims: number }> {
  const s = await read();
  const before = s.claims.length;
  s.claims = [];
  await write(s);
  return { claims: before };
}

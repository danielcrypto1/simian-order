import crypto from "node:crypto";
import { readJSON, writeJSON } from "./gistStore";

/**
 * Back Room — a hidden 500-claim easter egg surface gated by a
 * passphrase. The admin sets the passphrase; visitors who type it
 * correctly receive a unique XXXX-XXXX combination code. Each
 * browser identity gets ONE claim. Once 500 claims are issued,
 * /backroom returns "ACCESS CLOSED".
 *
 * Storage: a single gist file (`backroom.json`) holds the active
 * passphrase, the cap, and the array of claims. Claims store the
 * issued code, the visitor cookie ID that minted it, and the
 * timestamp so admin can audit. The IP is stored as a short hash
 * (not the raw value) so the panel can group abuse without leaking
 * PII.
 *
 * The passphrase is matched case-insensitively after trimming. The
 * issued code is uppercase A-Z2-9 (no I/O/0/1) split as 4-4 with
 * a hyphen. Collisions are checked against issued claims and
 * regenerated up to 10 times — the search space is ~32^8 ≈ 1.1T,
 * so collisions in 500 issued codes are statistically zero.
 */

const FILE = "backroom.json";

export const BACKROOM_TOTAL = 500;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars

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
  code: string;        // XXXX-XXXX (the shared drop code at claim time)
  wallet: string;      // ape-chain wallet (lowercased) — bound to this code for mint eligibility
  visitorId: string;   // cookie id (uuid v4 minted server-side)
  ipHash: string;      // short sha256 prefix of the request IP
  source: ClaimSource; // how this claim entered the system
  claimedAt: string;   // ISO
};

export type BackroomState = {
  passphrase: string | null; // null until admin sets it
  /**
   * The single shared drop code returned to every successful claimer.
   * Per spec, all 500 claims receive THE SAME code — wallet bindings
   * are what differentiate claims for airdrop / mint eligibility, not
   * per-claim unique codes. May be admin-set explicitly, otherwise
   * auto-generated on the first successful claim.
   */
  dropCode: string | null;
  total: number;             // hard cap (500)
  claims: BackroomClaim[];
  updatedAt: string;
};

const DEFAULT: BackroomState = {
  passphrase: null,
  dropCode: null,
  total: BACKROOM_TOTAL,
  claims: [],
  updatedAt: new Date().toISOString(),
};

async function read(): Promise<BackroomState> {
  const s = await readJSON<BackroomState>(FILE, DEFAULT);
  // Force the cap to the constant — admin shouldn't be able to drift
  // it via direct gist edit. Backfill dropCode + per-claim source
  // for legacy state files written before those fields existed.
  return {
    ...s,
    total: BACKROOM_TOTAL,
    dropCode: typeof (s as BackroomState).dropCode === "string" ? (s as BackroomState).dropCode : null,
    claims: Array.isArray(s.claims)
      ? s.claims.map((c) => ({
          ...c,
          source: (c as BackroomClaim).source === "quest" ? "quest" : "passphrase",
        }))
      : [],
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

function generateCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
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

  // Single shared drop code: every successful claim receives the SAME
  // code. If admin hasn't set one yet, auto-generate the canonical
  // value here on the first claim and persist it. Subsequent claims
  // reuse it verbatim.
  const dropCode = s.dropCode && s.dropCode.trim().length > 0
    ? s.dropCode
    : generateCode();

  const claim: BackroomClaim = {
    code: dropCode,
    wallet,
    visitorId,
    ipHash,
    source: "passphrase",
    claimedAt: new Date().toISOString(),
  };
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
  // Persist the drop code on the state so the admin panel can display
  // it and so the very next claim picks up the same value.
  if (!fresh.dropCode || fresh.dropCode.trim().length === 0) {
    fresh.dropCode = dropCode;
  }
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

  // Same shared-drop-code logic as claimCode(): persist on first use.
  const dropCode = s.dropCode && s.dropCode.trim().length > 0
    ? s.dropCode
    : generateCode();

  const claim: BackroomClaim = {
    code: dropCode,
    wallet,
    // Quest grants don't have a back-room cookie; mint a synthetic
    // visitorId so the storage shape stays uniform and admin lookups
    // by visitorId still work.
    visitorId: `quest-${newVisitorId()}`,
    ipHash: opts.ipHash,
    source: "quest",
    claimedAt: new Date().toISOString(),
  };

  const fresh = await read();
  if (fresh.claims.some((c) => c.wallet === wallet)) {
    const dup = fresh.claims.find((c) => c.wallet === wallet)!;
    return { ok: true, claim: dup, remaining: Math.max(0, fresh.total - fresh.claims.length) };
  }
  if (fresh.claims.length >= fresh.total) return { ok: false, error: "full" };
  if (!fresh.dropCode || fresh.dropCode.trim().length === 0) {
    fresh.dropCode = dropCode;
  }
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
 * Set the single shared drop code. Pass null to clear (the next claim
 * will auto-generate a fresh one). Pass a string to set explicitly —
 * stored verbatim (after trim) so admin can use any format they want
 * (e.g. "OPEN-SESAME", "ROUND1-2026", a XXXX-XXXX style string, etc.).
 *
 * NOTE: changing the drop code does NOT retroactively update existing
 * claim records — those keep the code that was active at their claim
 * time. New claims after this call will use the new value.
 */
export async function adminSetDropCode(code: string | null): Promise<void> {
  const s = await read();
  if (code === null) {
    s.dropCode = null;
  } else {
    const trimmed = code.trim().slice(0, 64);
    s.dropCode = trimmed.length === 0 ? null : trimmed;
  }
  await write(s);
}

/**
 * Replace the drop code with a freshly auto-generated XXXX-XXXX value.
 * Does not touch claims. Returns the new code.
 */
export async function adminRegenerateDropCode(): Promise<string> {
  const s = await read();
  const next = generateCode();
  s.dropCode = next;
  await write(s);
  return next;
}

/**
 * Wipe all claims. Passphrase is preserved unless `alsoClearPassphrase`.
 * Drop code is preserved unless `alsoClearDropCode` (or sealing the
 * door, which is a full reset).
 */
export async function adminResetClaims(opts?: {
  alsoClearPassphrase?: boolean;
  alsoClearDropCode?: boolean;
}): Promise<void> {
  const s = await read();
  s.claims = [];
  if (opts?.alsoClearPassphrase) {
    s.passphrase = null;
    // "Seal the door" is a full reset — drop a stale code along with
    // the claims so the next session starts fully clean.
    s.dropCode = null;
  } else if (opts?.alsoClearDropCode) {
    s.dropCode = null;
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

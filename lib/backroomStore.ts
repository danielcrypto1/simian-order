import crypto from "node:crypto";
import { readJSON, writeJSON } from "./gistStore";
import {
  BACKROOM_TOTAL as TOTAL,
  CODE_ALPHABET,
  codeToSlug,
  formatOrderCode,
  orderSlug,
  parseOrderSlug,
  slugToDisplayCode,
} from "./orderCodes";

// Re-export the pure helpers + constant so existing
// `from "@/lib/backroomStore"` imports keep working.
export {
  codeToSlug,
  formatOrderCode,
  orderSlug,
  parseOrderSlug,
  slugToDisplayCode,
};

/**
 * Generate a fresh random code in "XXXX-YYYY" form using an unambiguous
 * 32-char alphabet (no 0/O/1/I/L). 32^8 ≈ 1.1T possibilities — random
 * codes from the rollout onward replace the predictable sequential
 * "ORDER #N" format so people can't grind ticket spam by guessing
 * low-numbered codes.
 *
 * Callers pass the current claim list and the function retries on the
 * (vanishingly rare) collision until it finds an unused code.
 */
export function generateCode(existing: ReadonlyArray<BackroomClaim>): string {
  const taken = new Set(existing.map((c) => c.code));
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = crypto.randomBytes(8);
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      if (i === 3) out += "-";
    }
    if (!taken.has(out)) return out;
  }
  // 8 retries against a 1T-entropy space is astronomically unlikely
  // to fail. Throw rather than return a duplicate.
  throw new Error("generateCode: collision pool exhausted");
}

/**
 * Back Room — a hidden 500-claim easter egg surface. Visitors who
 * reach /void/deep are auto-issued a UNIQUE sequential code:
 * "ORDER #1", "ORDER #2", ..., "ORDER #500". They submit the code in
 * our Discord ticket to receive the HIGH ORDER role. Each browser
 * identity gets ONE claim (cookie-bound). Once 500 are issued,
 * /void/deep ends on "ACCESS CLOSED" instead of a code.
 *
 * Storage: a single gist file (`backroom.json`) holds the cap and
 * the array of claims. Claims store the issued code, the visitor
 * cookie ID that minted it, and the timestamp so admin can audit.
 * The IP is stored as a short hash (not the raw value) so the panel
 * can group abuse without leaking PII.
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
 *   "auto"       — visitor reached /void/deep and was auto-issued the
 *                  next sequential ORDER #N (no passphrase, no wallet).
 *                  Cookie-bound; one claim per browser identity.
 *   "quest"      — wallet completed all tasks at /dashboard/tasks and
 *                  was auto-granted an FCFS slot.
 *   "passphrase" — legacy: visitor typed a back-room passphrase at the
 *                  old /backroom page. Still recognised in storage so
 *                  pre-rollover claims keep their audit tag.
 *
 * Same 500 cap, single counter shared across all sources.
 */
export type ClaimSource = "auto" | "quest" | "passphrase";

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
  total: number;             // hard cap (500)
  claims: BackroomClaim[];
  updatedAt: string;
};

const DEFAULT: BackroomState = {
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
    claims: rawClaims.map((c, i) => {
      const raw = (c as BackroomClaim).source;
      const src: ClaimSource = raw === "quest" || raw === "auto" || raw === "passphrase" ? raw : "passphrase";
      return {
        ...c,
        source: src,
        index: typeof (c as BackroomClaim).index === "number" ? (c as BackroomClaim).index : i + 1,
      };
    }),
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
  claimed: BackroomClaim | null;
}> {
  const s = await read();
  const claimed =
    visitorId ? s.claims.find((c) => c.visitorId === visitorId) ?? null : null;
  return {
    total: s.total,
    remaining: Math.max(0, s.total - s.claims.length),
    full: s.claims.length >= s.total,
    claimed,
  };
}

export type AutoClaimResult =
  | { ok: true; claim: BackroomClaim; remaining: number }
  | { ok: false; error: "full" | "missing_visitor" | "internal_error" };

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Auto-issue the next sequential ORDER #N to a visitor. No passphrase,
 * no wallet — visitors who reach /void/deep get a code straight away.
 * Cookie-bound: the same `visitorId` always gets back the same claim
 * (idempotent re-fetch). Verification of "who owns this code" happens
 * downstream in our Discord ticket flow.
 */
export async function grantAutoCode(opts: {
  visitorId: string;
  ipHash: string;
}): Promise<AutoClaimResult> {
  const { visitorId, ipHash } = opts;
  if (!visitorId) return { ok: false, error: "missing_visitor" };

  const s = await read();

  // Idempotent: this visitor's cookie already holds a claim.
  const existing = s.claims.find((c) => c.visitorId === visitorId);
  if (existing) {
    return { ok: true, claim: existing, remaining: Math.max(0, s.total - s.claims.length) };
  }

  if (s.claims.length >= s.total) return { ok: false, error: "full" };

  // Re-read to narrow the cap-check / write race window.
  const fresh = await read();
  const dup = fresh.claims.find((c) => c.visitorId === visitorId);
  if (dup) {
    return { ok: true, claim: dup, remaining: Math.max(0, fresh.total - fresh.claims.length) };
  }
  if (fresh.claims.length >= fresh.total) return { ok: false, error: "full" };

  const index = fresh.claims.length + 1;
  const claim: BackroomClaim = {
    code: generateCode(fresh.claims),
    index,
    wallet: "", // auto-claim — no wallet binding
    visitorId,
    ipHash,
    source: "auto",
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
 * Grant an FCFS slot to a wallet via the tasks-completion auto-claim
 * flow at /dashboard/tasks: when a visitor finishes all tasks AND
 * submits their identity, the server books them a slot here.
 *
 * Same 500 cap and sequential numbering as `grantAutoCode` — only
 * the source tag ("quest") and the wallet binding differ.
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

  // Quest grants share the same 500-cap pool + counter as auto claims;
  // the random code generator collision-checks against the whole pool.
  const index = fresh.claims.length + 1;
  const claim: BackroomClaim = {
    code: generateCode(fresh.claims),
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

/**
 * Wipe all claims. Resets the sequential counter to 0 (next claim
 * becomes ORDER #1).
 */
export async function adminResetClaims(): Promise<void> {
  const s = await read();
  s.claims = [];
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

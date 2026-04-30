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

export type BackroomClaim = {
  code: string;        // XXXX-XXXX
  visitorId: string;   // cookie id (uuid v4 minted server-side)
  ipHash: string;      // short sha256 prefix of the request IP
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
  // it via direct gist edit.
  return { ...s, total: BACKROOM_TOTAL };
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
        | "rate_limited"
        | "internal_error";
    };

export async function claimCode(opts: {
  visitorId: string;
  ipHash: string;
  attempt: string;
}): Promise<ClaimResult> {
  const { visitorId, ipHash, attempt } = opts;
  if (!visitorId) return { ok: false, error: "missing_visitor" };

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

  const expected = s.passphrase.trim().toLowerCase();
  const got = (attempt || "").trim().toLowerCase();
  if (got !== expected) return { ok: false, error: "wrong_code" };

  if (s.claims.length >= s.total) return { ok: false, error: "full" };

  // Generate a unique code; retry on the (vanishingly unlikely) collision.
  const seen = new Set(s.claims.map((c) => c.code));
  let code = generateCode();
  for (let i = 0; i < 10 && seen.has(code); i++) code = generateCode();
  if (seen.has(code)) return { ok: false, error: "internal_error" };

  const claim: BackroomClaim = {
    code,
    visitorId,
    ipHash,
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
  if (fresh.claims.length >= fresh.total) return { ok: false, error: "full" };
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

/** Wipe all claims. Passphrase is preserved unless `alsoClearPassphrase`. */
export async function adminResetClaims(opts?: {
  alsoClearPassphrase?: boolean;
}): Promise<void> {
  const s = await read();
  s.claims = [];
  if (opts?.alsoClearPassphrase) s.passphrase = null;
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

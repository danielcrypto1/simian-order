import crypto from "node:crypto";

/**
 * Tiny in-memory IP rate limiter. Same shape as the bucket inside
 * `lib/backroomStore.ts` but exported as a factory so other endpoints
 * can mount their own counters without sharing a budget with the
 * back-room flow. Per-process state — on Vercel each lambda instance
 * gets its own counters, which is acceptable for spam mitigation
 * (combined with input validation) without needing Redis.
 *
 * Usage:
 *   const bucket = makeBucket({ windowMs: 60_000, max: 5 });
 *   if (!bucket.ok(ipHash)) return NextResponse.json(..., { status: 429 });
 */
export function makeBucket(opts: { windowMs: number; max: number }) {
  const state = new Map<string, { count: number; resetAt: number }>();
  return {
    ok(key: string): boolean {
      const now = Date.now();
      const cur = state.get(key);
      if (!cur || cur.resetAt < now) {
        state.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (cur.count >= opts.max) return false;
      cur.count += 1;
      return true;
    },
  };
}

/** Short SHA-256 prefix of an IP — used as the bucket key. */
export function hashIp(ip: string | null | undefined): string {
  if (!ip) return "anon";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

/** Best-effort IP from common proxy headers. Use inside a route handler. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

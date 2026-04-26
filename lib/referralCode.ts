import crypto from "node:crypto";

export const REFERRAL_LIMIT = 5;

/**
 * Deterministic referral code keyed off wallet + SESSION_SECRET.
 * Same wallet always yields the same code; can't be predicted without the secret.
 */
export function codeForWallet(wallet: string): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASS || "dev-only-no-secret-set";
  const h = crypto
    .createHash("sha256")
    .update(wallet.toLowerCase() + ":" + secret)
    .digest("hex");
  return "SIM-" + h.slice(0, 5).toUpperCase();
}

import crypto from "node:crypto";

export function newReferralCode(): string {
  const raw = crypto.randomBytes(4).toString("base64url").toUpperCase();
  return "SIM-" + raw.replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(5, "X");
}

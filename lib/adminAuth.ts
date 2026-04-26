// Web Crypto-based HMAC token sign/verify. Works in Edge runtime (middleware)
// and Node runtime (API routes). No node:crypto imports.

export const COOKIE_NAME = "admin-session";
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

export type AdminSession = { sub: string; exp: number };

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASS ||
    "dev-only-no-secret-set"
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function signAdminToken(sub = "admin", ttlSeconds = TOKEN_TTL_SECONDS): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify({ sub, exp })));
  const key = await getKey(["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return body + "." + b64urlEncode(new Uint8Array(sigBuf));
}

export async function verifyAdminToken(token: string | undefined | null): Promise<AdminSession | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const key = await getKey(["verify"]);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig),
      new TextEncoder().encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as AdminSession;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Constant-time compare of equal-length strings. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function checkCredentials(user: string, pass: string): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASS;
  if (!u || !p) return false;
  // Length leak via early-exit is acceptable; values come from env.
  return timingSafeEqualStr(user, u) && timingSafeEqualStr(pass, p);
}

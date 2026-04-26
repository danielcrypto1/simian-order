import crypto from "node:crypto";

const DEFAULT_TTL_SECONDS = 8 * 60 * 60;

function getSecret(): string {
  const s =
    process.env.SESSION_SECRET ||
    process.env.ADMIN_KEY ||
    "dev-only-no-secret-set";
  return s;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export type AdminTokenPayload = {
  sub: string;
  exp: number;
};

export function signAdminToken(sub: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = b64urlEncode(Buffer.from(JSON.stringify({ sub, exp })));
  const sig = b64urlEncode(
    crypto.createHmac("sha256", getSecret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyAdminToken(token: string | undefined | null): AdminTokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64urlEncode(
    crypto.createHmac("sha256", getSecret()).update(body).digest()
  );
  const sigBuf = b64urlDecode(sig);
  const expectedBuf = b64urlDecode(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as AdminTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function checkAdminCredentials(user: string, pass: string): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASS;
  if (!u || !p) return false;
  if (user.length !== u.length || pass.length !== p.length) return false;
  const userOk = crypto.timingSafeEqual(Buffer.from(user), Buffer.from(u));
  const passOk = crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(p));
  return userOk && passOk;
}

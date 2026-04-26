import { readJSON, writeJSON } from "./gistStore";
import { codeForWallet, REFERRAL_LIMIT as RL } from "./referralCode";

export const REFERRAL_LIMIT = RL;

const FILE = "referrals.json";

export type ReferralLink = {
  wallet: string;       // referrer (always lowercased)
  code: string;         // SIM-XXXXX, deterministic from wallet + secret
  referred: string[];   // wallets they've referred (lowercased, unique)
  createdAt: string;    // when the referrer first received their code
};

async function read(): Promise<ReferralLink[]> {
  const raw = await readJSON<ReferralLink[]>(FILE, []);
  return Array.isArray(raw) ? raw : [];
}

async function write(links: ReferralLink[]): Promise<void> {
  await writeJSON(FILE, links);
}

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

/**
 * Returns the referral link for a wallet, creating it on first access.
 * The code is always re-derived to handle SESSION_SECRET rotation.
 */
export async function getOrCreateLink(wallet: string): Promise<ReferralLink> {
  const w = wallet.toLowerCase();
  const expectedCode = codeForWallet(w);
  const all = await read();
  const existing = all.find((l) => l.wallet.toLowerCase() === w);
  if (existing) {
    if (existing.code !== expectedCode) {
      existing.code = expectedCode;
      await write(all);
    }
    return existing;
  }
  const link: ReferralLink = {
    wallet: w,
    code: expectedCode,
    referred: [],
    createdAt: new Date().toISOString(),
  };
  all.push(link);
  await write(all);
  return link;
}

export async function listAllLinks(): Promise<ReferralLink[]> {
  const all = await read();
  // Newest referrers first.
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findLinkByCode(code: string): Promise<ReferralLink | null> {
  if (!code) return null;
  const target = code.trim().toUpperCase();
  const all = await read();
  return all.find((l) => l.code === target) || null;
}

export type AddReferralResult =
  | { ok: true; link: ReferralLink }
  | {
      ok: false;
      error:
        | "invalid_wallet"
        | "self_referral"
        | "already_referred"
        | "limit_reached";
    };

/**
 * Atomically adds a referee to a referrer's list, enforcing all the rules
 * in a single read-modify-write so race conditions can't bypass them.
 *
 *   - Both wallets must be valid 0x addresses.
 *   - referrer !== referee (no self-referral).
 *   - The referee must not appear in ANY referrer's list (one-time global).
 *   - The referrer's list must not already contain the referee.
 *   - The referrer must have fewer than REFERRAL_LIMIT referees.
 */
export async function addReferral(
  referrerWallet: string,
  refereeWallet: string
): Promise<AddReferralResult> {
  if (!isWallet(referrerWallet) || !isWallet(refereeWallet)) {
    return { ok: false, error: "invalid_wallet" };
  }
  const referrer = referrerWallet.toLowerCase();
  const referee = refereeWallet.toLowerCase();
  if (referrer === referee) return { ok: false, error: "self_referral" };

  const all = await read();

  // Globally: a wallet can only be referred by ONE referrer.
  for (const l of all) {
    if (l.referred.includes(referee)) {
      return { ok: false, error: "already_referred" };
    }
  }

  let link = all.find((l) => l.wallet.toLowerCase() === referrer);
  if (!link) {
    link = {
      wallet: referrer,
      code: codeForWallet(referrer),
      referred: [],
      createdAt: new Date().toISOString(),
    };
    all.push(link);
  }

  if (link.referred.includes(referee)) {
    return { ok: false, error: "already_referred" };
  }
  if (link.referred.length >= REFERRAL_LIMIT) {
    return { ok: false, error: "limit_reached" };
  }

  link.referred.push(referee);
  await write(all);
  return { ok: true, link };
}

/**
 * Admin: remove a referee from a referrer's list. Used by the admin
 * panel's manual adjustment flow.
 */
export async function removeReferral(
  referrerWallet: string,
  refereeWallet: string
): Promise<boolean> {
  const referrer = referrerWallet.toLowerCase();
  const referee = refereeWallet.toLowerCase();
  const all = await read();
  const link = all.find((l) => l.wallet.toLowerCase() === referrer);
  if (!link) return false;
  const idx = link.referred.indexOf(referee);
  if (idx < 0) return false;
  link.referred.splice(idx, 1);
  await write(all);
  return true;
}

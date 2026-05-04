import { findByWallet } from "./applicationsStore";
import { listSubmissions } from "./submissionsStore";
import { adminGetState } from "./backroomStore";

/**
 * Cross-system wallet uniqueness.
 *
 * For OpenSea / airdrop export hygiene, every wallet must appear in at
 * most ONE of: HIGH ORDER applications, FIVE SUMMONING entries, or the
 * Back Room claim list. This module is the single source of truth for
 * that check — every entry point that records a wallet calls
 * `walletExistsElsewhere()` BEFORE writing, so duplicates can't enter
 * via concurrent flows.
 *
 * Storage is gist-backed (or local file in dev) — a few hundred bytes
 * each, fast enough to read in series on a write path.
 */

export type WalletRegistryHit =
  | "application"
  | "summoning_entry"
  | "backroom_claim";

export type WalletRegistryResult = {
  /** true if the wallet is recorded in at least one OTHER system. */
  exists: boolean;
  /** All systems that hold this wallet. May be empty. */
  hits: WalletRegistryHit[];
};

/**
 * Look up a wallet across all three persistent systems.
 *
 * `excludeSystem` lets a caller suppress its OWN system from the hit
 * list — e.g. `/api/apply` is upserting an application, so it doesn't
 * want a duplicate APPLICATION hit (that's its own row), only conflicts
 * with summoning + backroom.
 */
export async function walletExistsElsewhere(
  wallet: string,
  excludeSystem?: WalletRegistryHit
): Promise<WalletRegistryResult> {
  const w = wallet.toLowerCase().trim();
  if (!w) return { exists: false, hits: [] };

  // Read all three in parallel — each is a single gist file fetch.
  const [app, subs, br] = await Promise.all([
    excludeSystem === "application" ? Promise.resolve(undefined) : findByWallet(w),
    excludeSystem === "summoning_entry" ? Promise.resolve([]) : listSubmissions(),
    excludeSystem === "backroom_claim" ? Promise.resolve(null) : adminGetState(),
  ]);

  const hits: WalletRegistryHit[] = [];
  if (app) hits.push("application");

  // A summoning entry hit is any entry wallet across any submission —
  // referrer wallets are tracked under "application" already (they had
  // to be approved-applicants to submit), so we look at entry wallets.
  for (const s of subs) {
    if (s.entries.some((e) => e.wallet.toLowerCase() === w)) {
      hits.push("summoning_entry");
      break;
    }
  }

  if (br && br.claims.some((c) => (c.wallet || "").toLowerCase() === w)) {
    hits.push("backroom_claim");
  }

  return { exists: hits.length > 0, hits };
}

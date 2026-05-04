import { readJSON, writeJSON } from "./gistStore";

/**
 * KOL (key opinion leader) tag registry.
 *
 * A flat list of admin-tagged wallet addresses. The submissions
 * admin panel joins this against each submission's referrer wallet
 * to display a KOL badge + optional descriptive tag.
 *
 * Storage is intentionally separate from applications/submissions —
 * the KOL flag is admin metadata about a wallet, not derived from
 * any user action. Keeping it in its own gist file means clearing
 * applications doesn't drop KOL status.
 */

const FILE = "kols.json";

export type KolEntry = {
  wallet: string;     // lowercased
  tag: string;        // optional descriptive tag, may be ""
  addedAt: string;    // ISO timestamp
};

async function read(): Promise<KolEntry[]> {
  const raw = await readJSON<KolEntry[]>(FILE, []);
  return Array.isArray(raw) ? raw : [];
}

async function write(items: KolEntry[]): Promise<void> {
  await writeJSON(FILE, items);
}

export async function listKols(): Promise<KolEntry[]> {
  return read();
}

/** Returns the entry for a wallet (lowercased lookup), or null. */
export async function getKol(wallet: string): Promise<KolEntry | null> {
  const w = wallet.toLowerCase().trim();
  if (!w) return null;
  const all = await read();
  return all.find((k) => k.wallet === w) ?? null;
}

/**
 * Resolve a batch of wallets to a Map<wallet, tag>. Wallets without
 * an entry are absent from the map. Used by the admin submissions
 * list to attach `isKOL` + `tag` to each row in a single read.
 */
export async function getKolMap(wallets: string[]): Promise<Map<string, string>> {
  const all = await read();
  const set = new Set(wallets.map((w) => w.toLowerCase()));
  const out = new Map<string, string>();
  for (const k of all) {
    if (set.has(k.wallet)) out.set(k.wallet, k.tag);
  }
  return out;
}

/** Add or update a KOL entry. */
export async function upsertKol(wallet: string, tag = ""): Promise<KolEntry> {
  const w = wallet.toLowerCase().trim();
  const t = tag.trim().slice(0, 64);
  const all = await read();
  const idx = all.findIndex((k) => k.wallet === w);
  const entry: KolEntry = {
    wallet: w,
    tag: t,
    addedAt: idx >= 0 ? all[idx].addedAt : new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  await write(all);
  return entry;
}

/** Remove a KOL entry. Returns true if anything was removed. */
export async function removeKol(wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase().trim();
  const all = await read();
  const idx = all.findIndex((k) => k.wallet === w);
  if (idx < 0) return false;
  all.splice(idx, 1);
  await write(all);
  return true;
}

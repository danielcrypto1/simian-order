// Process-scope in-memory store for the admin panel.
// On Vercel serverless this resets per cold start and isn't shared between
// instances; see README for the prod-grade swap (Postgres / Vercel KV).

export type Phase = "GTD" | "FCFS";

export type WhitelistEntry = {
  wallet: string;
  phase: Phase;
  maxMint: number;
  addedAt: string;
};

export type MintConfig = {
  total_supply: number;
  gtd_allocation: number;
  fcfs_allocation: number;
  gtd_max_mint: number;
  fcfs_max_mint: number;
  public_max_mint: number;
  gtd_active: boolean;
  fcfs_active: boolean;
  public_active: boolean;
  royalty_bps: number;
};

export type Store = {
  whitelist: Map<string, WhitelistEntry>;
  mintConfig: MintConfig;
  fcfsState: { total: number; taken: number; claimed: Set<string> };
  // Applications live in lib/applicationsStore.ts (gist-backed).
  // Referrals live in lib/referralsStore.ts (gist-backed).
};

declare global {
  // eslint-disable-next-line no-var
  var __SIMIAN_ADMIN_STORE__: Store | undefined;
}

function defaultMintConfig(): MintConfig {
  return {
    total_supply: 3333,
    gtd_allocation: 1000,
    fcfs_allocation: 1000,
    gtd_max_mint: 1,
    fcfs_max_mint: 2,
    public_max_mint: 2,
    gtd_active: false,
    fcfs_active: false,
    public_active: false,
    royalty_bps: 690,
  };
}

export function getStore(): Store {
  if (!globalThis.__SIMIAN_ADMIN_STORE__) {
    globalThis.__SIMIAN_ADMIN_STORE__ = {
      whitelist: new Map(),
      mintConfig: defaultMintConfig(),
      fcfsState: { total: 50, taken: 0, claimed: new Set() },
    };
  }
  return globalThis.__SIMIAN_ADMIN_STORE__;
}

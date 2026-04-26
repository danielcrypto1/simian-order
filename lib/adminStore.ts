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

export type Application = {
  wallet: string;
  handle: string;
  twitter: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
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
  applications: Application[];
  mintConfig: MintConfig;
  fcfsState: { total: number; taken: number; claimed: Set<string> };
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

function seedApplications(): Application[] {
  return [
    {
      wallet: "0x9a3f000000000000000000000000000000c00de1",
      handle: "@apefrog",
      twitter: "apefrog",
      status: "pending",
      submittedAt: "2026-04-22T10:00:00Z",
    },
    {
      wallet: "0x44ab2cccccccccccccccccccccccccccccccccc2",
      handle: "@bera_lord",
      twitter: "bera_lord",
      status: "pending",
      submittedAt: "2026-04-23T11:00:00Z",
    },
    {
      wallet: "0xaaaa00000000000000000000000000000000ffff",
      handle: "@nopants",
      twitter: "nopants",
      status: "approved",
      submittedAt: "2026-04-21T09:00:00Z",
    },
  ];
}

export function getStore(): Store {
  if (!globalThis.__SIMIAN_ADMIN_STORE__) {
    globalThis.__SIMIAN_ADMIN_STORE__ = {
      whitelist: new Map(),
      applications: seedApplications(),
      mintConfig: defaultMintConfig(),
      fcfsState: { total: 50, taken: 0, claimed: new Set() },
    };
  }
  return globalThis.__SIMIAN_ADMIN_STORE__;
}

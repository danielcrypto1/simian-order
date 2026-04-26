"use client";

// All routes are same-origin Next.js API routes. Auth is via httpOnly cookie
// set by /api/admin/login; we just send `credentials: 'include'`.

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "network_error");
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (json && (json as any).error) || `http_${res.status}`;
    throw new ApiError(res.status, msg, (json as any)?.details ?? (json as any)?.errors);
  }
  return json as T;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return null; }
}

export type WhitelistEntry = { wallet: string; phase: "GTD" | "FCFS"; maxMint: number; addedAt: string };
export type Application = {
  id: string;
  wallet: string;
  twitter: string;
  why: string | null;
  discord: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};
export type Cfg = {
  mint: {
    total_supply: number; gtd_allocation: number; fcfs_allocation: number;
    gtd_max_mint: number; fcfs_max_mint: number; public_max_mint: number;
    gtd_active: boolean; fcfs_active: boolean; public_active: boolean;
    royalty_bps: number;
  };
  royalty_bps: number;
  fcfs_state: { total: number; taken: number; remaining: number };
};

export const adminApi = {
  login: (username: string, password: string) =>
    req<{ success: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  session: () => req<{ user: string; exp: number }>("/api/admin/session"),

  getConfig: () => req<Cfg>("/api/admin/config"),
  patchConfig: (patch: Record<string, unknown>) =>
    req<unknown>("/api/admin/config", { method: "PATCH", body: JSON.stringify(patch) }),

  resetFcfs: () =>
    req<{ ok: boolean; total: number; taken: number; remaining: number }>(
      "/api/admin/fcfs/reset", { method: "POST" }
    ),

  listApplications: () => req<{ items: Application[]; total: number }>("/api/admin/applications"),
  approveApplication: (w: string) =>
    req<unknown>(`/api/admin/applications/${w}/approve`, { method: "POST" }),
  rejectApplication: (w: string) =>
    req<unknown>(`/api/admin/applications/${w}/reject`, { method: "POST" }),
  deleteApplication: (w: string) =>
    req<{ ok: boolean }>(`/api/admin/applications/${w}`, { method: "DELETE" }),

  listReferrals: () =>
    req<{
      items: Array<{
        wallet: string; code: string; count: number; limit: number; createdAt: string;
        referred: Array<{ wallet: string; twitter: string | null; status: string | null }>;
      }>;
      total: number;
      totalReferred: number;
    }>("/api/admin/referrals"),
  simulateReferral: (referrer: string, referee?: string) =>
    req<{ ok: boolean; referrer: string; referee: string }>("/api/admin/referrals/simulate", {
      method: "POST",
      body: JSON.stringify({ referrer, referee }),
    }),
  removeReferral: (referrer: string, referee: string) =>
    req<{ ok: boolean }>("/api/admin/referrals/remove", {
      method: "POST",
      body: JSON.stringify({ referrer, referee }),
    }),

  listUploads: () =>
    req<{
      items: Array<{
        name: string;
        kind: "image" | "json";
        size: number;
        contentType: string;
        uploadedAt: string;
        url: string;
        metadata?: {
          name?: string;
          description?: string;
          image?: string;
          attributes?: Array<{ trait_type: string; value: string | number }>;
        } | null;
      }>;
      total: number;
    }>("/api/admin/uploads"),
  uploadAsset: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<{ ok: boolean; entry: any }>("/api/admin/uploads", {
      method: "POST",
      body: fd,
    });
  },
  deleteUpload: (name: string) =>
    req<{ ok: boolean }>(`/api/admin/uploads/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  runSystemTest: (only?: "application" | "approval" | "referral" | "fcfs" | "signature") =>
    req<{
      tests: Array<{
        id: "application" | "approval" | "referral" | "fcfs" | "signature";
        name: string;
        status: "PASS" | "FAIL";
        message: string;
        ms: number;
      }>;
      total: number;
      passed: number;
      failed: number;
    }>(`/api/admin/system-test${only ? `?only=${only}` : ""}`, { method: "POST" }),

  auditLinks: () =>
    req<{
      items: Array<{
        path: string;
        method: string;
        group: "page" | "api-public" | "api-admin";
        label: string;
        status: "OK" | "BROKEN" | "POST-ONLY";
        code: number | null;
        expected: number[];
        ms: number | null;
      }>;
      total: number;
      ok: number;
      broken: number;
      postOnly: number;
    }>("/api/admin/audit-links"),

  listWhitelist: () => req<{ items: WhitelistEntry[]; total: number }>("/api/admin/whitelist"),
  addWhitelist: (entry: { wallet: string; phase: "GTD" | "FCFS"; maxMint: number }) =>
    req<{ ok: boolean; entry: WhitelistEntry }>("/api/admin/whitelist", {
      method: "POST", body: JSON.stringify(entry),
    }),
  updateWhitelist: (
    wallet: string,
    entry: { phase: "GTD" | "FCFS"; maxMint: number }
  ) =>
    req<{ ok: boolean; entry: WhitelistEntry }>(`/api/admin/whitelist/${wallet}`, {
      method: "PUT", body: JSON.stringify(entry),
    }),
  deleteWhitelist: (wallet: string) =>
    req<{ ok: boolean }>(`/api/admin/whitelist/${wallet}`, { method: "DELETE" }),
  uploadWhitelist: (file: File, mode: "append" | "overwrite") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    return req<{ ok: boolean; mode: string; added: number; total: number }>(
      "/api/admin/whitelist/upload", { method: "POST", body: fd }
    );
  },
};

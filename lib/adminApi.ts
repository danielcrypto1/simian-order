"use client";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:4000";

const TOKEN_KEY = "simian:admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (init.auth !== false) {
    const token = getAdminToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, "network_error");
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (json && (json as any).error) || `http_${res.status}`;
    throw new ApiError(res.status, msg, (json as any)?.details);
  }
  return json as T;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return null; }
}

export const adminApi = {
  login: (user: string, pass: string) =>
    request<{ token: string; user: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ user, pass }),
      auth: false,
    }),
  session: () => request<{ user: string; exp: number }>("/api/admin/session"),
  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  getConfig: () =>
    request<{
      mint: {
        total_supply: number;
        gtd_allocation: number;
        fcfs_allocation: number;
        gtd_max_mint: number;
        fcfs_max_mint: number;
        public_max_mint: number;
        gtd_active: boolean;
        fcfs_active: boolean;
        public_active: boolean;
      };
      royalty_bps: number;
      fcfs_state: { total: number; taken: number; remaining: number };
    }>("/api/admin/config"),
  patchConfig: (patch: Record<string, unknown>) =>
    request<unknown>("/api/admin/config", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  resetFcfs: () =>
    request<{ reset: boolean; total: number; taken: number }>("/api/admin/fcfs/reset", {
      method: "POST",
    }),
  listApplications: (status?: string) =>
    request<{
      items: {
        id: number;
        wallet_address: string;
        handle: string | null;
        twitter_id: string | null;
        status: string;
        submitted_at: string;
      }[];
      total: number;
    }>(`/api/admin/applications${status ? `?status=${status}` : ""}`),
  approveApplication: (wallet: string) =>
    request<unknown>(`/api/applications/${wallet}/approve`, { method: "POST" }),
  rejectApplication: (wallet: string) =>
    request<unknown>(`/api/applications/${wallet}/reject`, { method: "POST" }),
  listUsers: () =>
    request<{
      items: {
        wallet_address: string;
        twitter_id: string | null;
        application_status: string;
        fcfs_allocated: boolean;
        referral_code: string | null;
        referrer: string | null;
        referral_count: number;
      }[];
      total: number;
    }>("/api/admin/users?limit=100"),
  patchUser: (wallet: string, body: Record<string, unknown>) =>
    request<unknown>(`/api/admin/users/${wallet}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

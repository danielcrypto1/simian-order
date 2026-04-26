// Single registry of every internal route the app exposes. The admin
// Link Audit page probes each one and reports OK / BROKEN status.
//
// `auth: 'admin'` routes are probed with the caller's admin cookie so the
// audit reflects the admin's view of the world. `expect` lists the HTTP
// status codes treated as healthy.

export type RouteAuth = "public" | "admin";

export type RegistryEntry = {
  path: string;
  method: "GET" | "HEAD";
  auth: RouteAuth;
  expect: number[];
  group: "page" | "api-public" | "api-admin";
  label: string;
  // Optional probe body / query string — only used for routes that need
  // params to be valid. POST routes are probed with a minimal payload that
  // exercises the validation path; we accept 4xx as "responding" since
  // payload-driven validation isn't a routing concern.
};

export const ROUTE_REGISTRY: RegistryEntry[] = [
  // ─── Pages ────────────────────────────────────────────────────────
  { path: "/",                       method: "GET", auth: "public", expect: [200],            group: "page", label: "Landing" },
  { path: "/dashboard",              method: "GET", auth: "public", expect: [200],            group: "page", label: "Dashboard home" },
  { path: "/dashboard/tasks",        method: "GET", auth: "public", expect: [200],            group: "page", label: "Tasks" },
  { path: "/dashboard/apply",        method: "GET", auth: "public", expect: [200],            group: "page", label: "Apply" },
  { path: "/dashboard/referral",     method: "GET", auth: "public", expect: [200],            group: "page", label: "Referral" },
  { path: "/dashboard/mint",         method: "GET", auth: "public", expect: [200],            group: "page", label: "Mint" },
  { path: "/admin/login",            method: "GET", auth: "public", expect: [200],            group: "page", label: "Admin login" },
  { path: "/admin",                  method: "GET", auth: "admin",  expect: [200, 307],       group: "page", label: "Admin dashboard (307 if no cookie)" },

  // ─── Public APIs (GET-only probes) ────────────────────────────────
  { path: "/api/claim-fcfs",                                                method: "GET", auth: "public", expect: [200], group: "api-public", label: "FCFS state" },
  { path: "/api/referral?wallet=0x0000000000000000000000000000000000000000", method: "GET", auth: "public", expect: [200], group: "api-public", label: "Referral link by wallet" },

  // ─── Admin APIs (GETs probed with admin cookie; POSTs are listed but skipped from probe) ───
  { path: "/api/admin/session",       method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Admin session" },
  { path: "/api/admin/config",        method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Admin config" },
  { path: "/api/admin/applications",  method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Applications list" },
  { path: "/api/admin/whitelist",     method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Whitelist list" },
  { path: "/api/admin/referrals",     method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Referrals list" },
  { path: "/api/admin/uploads",       method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Uploads list" },
];

// POST/PATCH/DELETE routes that exist but aren't probed (would need real
// payloads). Listed in the audit table as "POST-only" so the operator can
// see they're registered.
export const POST_ONLY_ROUTES: { path: string; group: "api-public" | "api-admin"; label: string }[] = [
  { path: "/api/apply",                                  group: "api-public", label: "Submit application" },
  { path: "/api/claim-fcfs",                             group: "api-public", label: "Claim FCFS slot" },
  { path: "/api/signature/get-signature",                group: "api-public", label: "Mint signature" },
  { path: "/api/admin/login",                            group: "api-admin",  label: "Admin login" },
  { path: "/api/admin/logout",                           group: "api-admin",  label: "Admin logout" },
  { path: "/api/admin/config",                           group: "api-admin",  label: "Patch config (PATCH)" },
  { path: "/api/admin/fcfs/reset",                       group: "api-admin",  label: "Reset FCFS" },
  { path: "/api/admin/applications/[wallet]/approve",    group: "api-admin",  label: "Approve application" },
  { path: "/api/admin/applications/[wallet]/reject",     group: "api-admin",  label: "Reject application" },
  { path: "/api/admin/applications/[wallet]",            group: "api-admin",  label: "Delete application (DELETE)" },
  { path: "/api/admin/whitelist",                        group: "api-admin",  label: "Add whitelist entry" },
  { path: "/api/admin/whitelist/upload",                 group: "api-admin",  label: "Whitelist CSV/XLSX upload" },
  { path: "/api/admin/whitelist/[wallet]",               group: "api-admin",  label: "Update/delete whitelist entry" },
  { path: "/api/admin/referrals/simulate",               group: "api-admin",  label: "Simulate referral" },
  { path: "/api/admin/referrals/remove",                 group: "api-admin",  label: "Remove referral" },
  { path: "/api/admin/uploads",                          group: "api-admin",  label: "Upload asset" },
  { path: "/api/admin/uploads/[name]",                   group: "api-admin",  label: "Delete asset" },
  { path: "/api/uploads/file/[name]",                    group: "api-public", label: "Public file proxy" },
];

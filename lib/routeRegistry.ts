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
  { path: "/void",                   method: "GET", auth: "public", expect: [200],            group: "page", label: "Void (hidden)" },
  { path: "/backroom",               method: "GET", auth: "public", expect: [200],            group: "page", label: "Back Room (hidden)" },
  { path: "/admin/login",            method: "GET", auth: "public", expect: [200],            group: "page", label: "Admin login" },
  { path: "/admin",                  method: "GET", auth: "admin",  expect: [200, 307],       group: "page", label: "Admin dashboard (307 if no cookie)" },

  // ─── Public APIs (GET-only probes) ────────────────────────────────
  { path: "/api/config",                                                     method: "GET", auth: "public", expect: [200], group: "api-public", label: "Public config (round number)" },
  { path: "/api/round",                                                      method: "GET", auth: "public", expect: [200], group: "api-public", label: "Current round (alias)" },
  { path: "/api/referrals?wallet=0x0000000000000000000000000000000000000000", method: "GET", auth: "public", expect: [200], group: "api-public", label: "Submission lookup by wallet" },
  { path: "/api/backroom",                                                   method: "GET", auth: "public", expect: [200], group: "api-public", label: "Back Room visitor status" },
  { path: "/api/share-card?round=1",                                         method: "GET", auth: "public", expect: [200], group: "api-public", label: "Approval share card (PNG)" },

  // ─── Admin APIs (GETs probed with admin cookie; POSTs are listed but skipped from probe) ───
  { path: "/api/admin/session",       method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Admin session" },
  { path: "/api/admin/config",        method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Admin config" },
  { path: "/api/admin/applications",  method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Applications list" },
  { path: "/api/admin/referrals",     method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Submitted referrals list" },
  { path: "/api/admin/kol",           method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "KOL registry list" },
  { path: "/api/admin/backroom",      method: "GET", auth: "admin",  expect: [200, 401],  group: "api-admin", label: "Back Room state" },
  { path: "/api/admin/export/high-order", method: "GET", auth: "admin", expect: [200, 401], group: "api-admin", label: "Export — HIGH ORDER (CSV)" },
  { path: "/api/admin/export/fcfs",       method: "GET", auth: "admin", expect: [200, 401], group: "api-admin", label: "Export — FCFS / Back Room (CSV)" },
];

// POST/PATCH/DELETE routes that exist but aren't probed (would need real
// payloads). Listed in the audit table as "POST-only" so the operator can
// see they're registered.
export const POST_ONLY_ROUTES: { path: string; group: "api-public" | "api-admin"; label: string }[] = [
  { path: "/api/apply",                                  group: "api-public", label: "Submit application" },
  { path: "/api/referrals/submit-list",                  group: "api-public", label: "Submit curated list of 5" },
  { path: "/api/backroom/claim",                         group: "api-public", label: "Back Room: claim with passphrase" },
  { path: "/api/fcfs/grant",                             group: "api-public", label: "FCFS: auto-grant for tasks-completers" },
  { path: "/api/admin/login",                            group: "api-admin",  label: "Admin login" },
  { path: "/api/admin/logout",                           group: "api-admin",  label: "Admin logout" },
  { path: "/api/admin/config",                           group: "api-admin",  label: "Patch config (PATCH)" },
  { path: "/api/admin/set-round",                        group: "api-admin",  label: "Set round number" },
  { path: "/api/admin/applications/[wallet]/approve",    group: "api-admin",  label: "Approve application" },
  { path: "/api/admin/applications/[wallet]/reject",     group: "api-admin",  label: "Reject application" },
  { path: "/api/admin/applications/[wallet]",            group: "api-admin",  label: "Delete application (DELETE)" },
  { path: "/api/admin/referrals/decide",                 group: "api-admin",  label: "Decide submission entry" },
  { path: "/api/admin/kol",                              group: "api-admin",  label: "Add/remove KOL tag" },
  { path: "/api/admin/backroom",                         group: "api-admin",  label: "Set Back Room passphrase (POST)" },
  { path: "/api/admin/backroom/reset",                   group: "api-admin",  label: "Reset Back Room claims" },
];

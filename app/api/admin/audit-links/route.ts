import { NextResponse } from "next/server";
import { POST_ONLY_ROUTES, ROUTE_REGISTRY } from "@/lib/routeRegistry";

export const runtime = "nodejs";

type AuditRow = {
  path: string;
  method: string;
  group: string;
  label: string;
  status: "OK" | "BROKEN" | "POST-ONLY";
  code: number | null;
  expected: number[];
  ms: number | null;
};

export async function GET(req: Request) {
  // Build the absolute origin to fetch ourselves with. NEXT_PUBLIC_SITE_URL
  // would be cleaner but we don't have it set; reconstruct from headers.
  const url = new URL(req.url);
  const origin = url.origin;
  const cookie = req.headers.get("cookie") ?? "";

  const probes = await Promise.all(
    ROUTE_REGISTRY.map(async (r): Promise<AuditRow> => {
      const t0 = Date.now();
      try {
        const res = await fetch(origin + r.path, {
          method: r.method,
          // Pass admin cookie through so admin-gated GETs return 200 not 401.
          headers: cookie ? { cookie } : {},
          redirect: "manual",
          cache: "no-store",
        });
        const ms = Date.now() - t0;
        const ok = r.expect.includes(res.status);
        return {
          path: r.path,
          method: r.method,
          group: r.group,
          label: r.label,
          status: ok ? "OK" : "BROKEN",
          code: res.status,
          expected: r.expect,
          ms,
        };
      } catch {
        return {
          path: r.path,
          method: r.method,
          group: r.group,
          label: r.label,
          status: "BROKEN",
          code: null,
          expected: r.expect,
          ms: Date.now() - t0,
        };
      }
    })
  );

  const postOnly: AuditRow[] = POST_ONLY_ROUTES.map((r) => ({
    path: r.path,
    method: "POST",
    group: r.group,
    label: r.label,
    status: "POST-ONLY",
    code: null,
    expected: [],
    ms: null,
  }));

  const all = [...probes, ...postOnly];
  const broken = all.filter((r) => r.status === "BROKEN").length;
  const ok = all.filter((r) => r.status === "OK").length;

  return NextResponse.json({
    items: all,
    total: all.length,
    ok,
    broken,
    postOnly: postOnly.length,
  });
}

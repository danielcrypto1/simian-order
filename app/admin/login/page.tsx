"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import { adminApi, ApiError } from "@/lib/adminApi";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="border-b border-border">
        <div className="max-w-[1000px] mx-auto px-3 py-2 flex items-center justify-between">
          <span className="text-xxs uppercase tracking-widest text-mute">
            simian.order // admin // restricted
          </span>
          <span className="text-xxs uppercase tracking-widest text-mute">v0.0.1</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 py-10">
        <div className="w-full max-w-[440px]">
          <div className="panel shadow-hard">
            <div className="panel-header">
              <span>:: login.htm</span>
              <span className="text-ape-300 normal-case font-normal">admin only</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-center"><Logo size="lg" /></div>
              <p className="text-center text-xxs uppercase tracking-widest text-mute">
                authorised personnel
              </p>
              <div className="divider-old" />

              <Suspense fallback={<div className="text-xxs text-mute">loading…</div>}>
                <LoginForm />
              </Suspense>

              <div className="text-xxs text-mute text-center pt-2">
                credentials live in the backend env. they never leave the server.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await adminApi.login(user, pass);
      router.replace(next.startsWith("/admin") ? next : "/admin");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 401
            ? "invalid credentials"
            : e.status === 503
            ? "admin not configured (set ADMIN_USER / ADMIN_PASS)"
            : e.status === 0
            ? "cannot reach api"
            : e.message
          : "unknown error";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">user</label>
        <input
          className="field"
          autoComplete="username"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div>
        <label className="label">password</label>
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
      </div>

      {err && (
        <div className="border border-red-700 bg-red-950 text-red-200 px-2 py-1 text-xxs uppercase tracking-wide">
          error: {err}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? "Validating..." : "Sign in"}
      </Button>
    </form>
  );
}

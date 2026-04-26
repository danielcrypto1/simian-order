"use client";

import { useRouter } from "next/navigation";
import Logo from "./Logo";
import Button from "./Button";
import { adminApi } from "@/lib/adminApi";

export default function AdminTopBar({ user }: { user: string | null }) {
  const router = useRouter();
  async function logout() {
    try { await adminApi.logout(); } catch {}
    router.replace("/admin/login");
  }
  return (
    <header className="bg-ape-900 border-b-2 border-border">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-xxs uppercase tracking-widest text-ape-300">
            // admin console
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xxs uppercase font-mono text-ape-200">
            {user ?? "—"}
          </span>
          <Button variant="ghost" onClick={logout}>Sign out</Button>
        </div>
      </div>
    </header>
  );
}

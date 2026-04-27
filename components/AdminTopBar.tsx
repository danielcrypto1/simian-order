"use client";

import { useRouter } from "next/navigation";
import Logo from "./Logo";
import { adminApi } from "@/lib/adminApi";

export default function AdminTopBar({ user }: { user: string | null }) {
  const router = useRouter();
  async function logout() {
    try { await adminApi.logout(); } catch {}
    router.replace("/admin/login");
  }
  return (
    <header className="border-b border-border bg-black/60">
      <div className="border-b border-bleed">
        <div className="max-w-[1200px] mx-auto px-3 py-[2px] flex items-center justify-between text-xxxs uppercase tracking-widest2 font-mono text-bleed">
          <span>// admin / restricted</span>
          <span className="hidden sm:inline">do not screenshot</span>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-xxs italic font-serif text-mute">
            &mdash; admin console
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xxs uppercase tracking-wider text-bone">
            {user ?? "—"}
          </span>
          <button onClick={logout} className="text-link">
            sign out
          </button>
        </div>
      </div>
    </header>
  );
}

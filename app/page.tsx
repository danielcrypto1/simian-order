"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import SiteFooter from "@/components/SiteFooter";
import { track } from "@/lib/analytics";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="border-b border-border">
        <div className="max-w-[1000px] mx-auto px-3 py-2 flex items-center justify-between">
          <span className="text-xxs uppercase tracking-widest text-mute hover-flicker">
            simian.order // ape-chain // mmxxvi
          </span>
          <span className="text-xxs uppercase tracking-widest text-mute">
            v0.0.1 — alpha
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 py-12">
        <div className="w-full max-w-[760px]">
          <div className="panel shadow-hard">
            <div className="panel-header">
              <span>:: index.htm</span>
              <span className="text-ape-300 normal-case font-normal">private members area</span>
            </div>

            <div className="p-6 sm:p-10">
              <div className="flex justify-center mb-8 hover-flicker">
                <Logo size="lg" />
              </div>

              <h1 className="headline text-center text-ape-100 text-5xl sm:text-7xl hover-flicker">
                Entry is earned<span className="text-ape-300 blink">.</span>
              </h1>

              <p className="text-center text-mute uppercase tracking-[0.4em] text-xxs mt-5">
                3333 &middot; ape-chain &middot; gated
              </p>

              <div className="divider-old my-8" />

              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/dashboard" onClick={() => track("landing_enter_click")}>
                  <Button variant="primary">Enter</Button>
                </Link>
                <Link href="/dashboard/apply" onClick={() => track("landing_apply_click")}>
                  <Button>Apply</Button>
                </Link>
                <ConnectWalletButton variant="ghost" />
              </div>

              <div className="divider-old my-8" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-border bg-ape-950 px-2 py-2 hover-flicker">
                  <div className="text-ape-300 text-xxs uppercase">supply</div>
                  <div className="text-ape-100 font-mono">3333</div>
                </div>
                <div className="border border-border bg-ape-950 px-2 py-2 hover-flicker">
                  <div className="text-ape-300 text-xxs uppercase">royalty</div>
                  <div className="text-ape-100 font-mono">6.9%</div>
                </div>
                <div className="border border-border bg-ape-950 px-2 py-2 hover-flicker">
                  <div className="text-ape-300 text-xxs uppercase">gate</div>
                  <div className="text-ape-100 font-mono">open</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-xxs text-mute uppercase tracking-widest">
            &lt;-- nothing here is for everyone --&gt;
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

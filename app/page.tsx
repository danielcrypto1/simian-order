import Link from "next/link";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import ConnectWalletButton from "@/components/ConnectWalletButton";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="border-b border-border">
        <div className="max-w-[1000px] mx-auto px-3 py-2 flex items-center justify-between">
          <span className="text-xxs uppercase tracking-widest text-mute">
            simian.order // ape-chain // mmxxvi
          </span>
          <span className="text-xxs uppercase tracking-widest text-mute">
            v0.0.1 — alpha
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 py-10">
        <div className="w-full max-w-[720px]">
          <div className="panel shadow-hard">
            <div className="panel-header">
              <span>:: index.htm</span>
              <span className="text-ape-300 normal-case font-normal">private members area</span>
            </div>
            <div className="p-8">
              <div className="flex justify-center mb-6">
                <Logo size="lg" />
              </div>

              <p className="text-center text-ape-200 max-w-[480px] mx-auto leading-relaxed">
                a quiet collective of 3333 simians.
                <br />
                gated. ranked. on ape-chain.
              </p>

              <div className="divider-old my-6" />

              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/dashboard">
                  <Button variant="primary">Enter</Button>
                </Link>
                <Link href="/dashboard/apply">
                  <Button>Apply</Button>
                </Link>
                <ConnectWalletButton variant="ghost" />
              </div>

              <div className="divider-old my-6" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-border bg-ape-950 px-2 py-2">
                  <div className="text-ape-300 text-xxs uppercase">supply</div>
                  <div className="text-ape-100 font-mono">3333</div>
                </div>
                <div className="border border-border bg-ape-950 px-2 py-2">
                  <div className="text-ape-300 text-xxs uppercase">phase</div>
                  <div className="text-ape-100 font-mono">II / IV</div>
                </div>
                <div className="border border-border bg-ape-950 px-2 py-2">
                  <div className="text-ape-300 text-xxs uppercase">gate</div>
                  <div className="text-ape-100 font-mono">open</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-xxs text-mute uppercase tracking-widest">
            &lt;-- nothing here is for everyone --&gt;
          </div>
        </div>
      </div>

      <footer className="border-t border-border">
        <div className="max-w-[1000px] mx-auto px-3 py-2 text-xxs uppercase text-mute flex justify-between">
          <span>(c) the order, mmxxvi</span>
          <span>built on ape</span>
        </div>
      </footer>
    </main>
  );
}

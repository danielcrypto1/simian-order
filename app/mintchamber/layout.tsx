import TopBar from "@/components/TopBar";
import TerminalBar from "@/components/TerminalBar";
import SiteFooter from "@/components/SiteFooter";
import MediaBackground from "@/components/MediaBackground";

/**
 * Mint Chamber gets its own layout instead of AppShell because AppShell
 * constrains main to ~860px with a hard left margin (good for the
 * dashboard's column-of-rooms read, bad for a minter that wants the
 * whole viewport). Same chrome — TopBar, TerminalBar, SiteFooter — but
 * the content area is now a wide centered container.
 */
export default function MintChamberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <MediaBackground
        photo
        variant={2}
        overlay="bars"
        opacity={0.22}
        blur={12}
      />
      <TopBar />
      <TerminalBar />
      <main className="relative z-[1] flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-10 py-8 sm:py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

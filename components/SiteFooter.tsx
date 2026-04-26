import { SOCIAL } from "@/lib/links";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-ape-900">
      <div className="max-w-[1200px] mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2 text-xxs uppercase tracking-widest text-mute">
        <span>(c) the order, mmxxvi</span>

        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href={SOCIAL.X}
            target="_blank"
            rel="noreferrer"
            className="no-underline text-ape-300 hover:text-white hover-flicker"
          >
            x ↗
          </a>
          <span className="text-border">|</span>
          <a
            href={SOCIAL.DISCORD}
            target="_blank"
            rel="noreferrer"
            className="no-underline text-ape-300 hover:text-white hover-flicker"
          >
            discord ↗
          </a>
          <span className="text-border">|</span>
          <a
            href={SOCIAL.APECHAIN}
            target="_blank"
            rel="noreferrer"
            className="no-underline text-ape-300 hover:text-white hover-flicker"
          >
            ape-chain ↗
          </a>
        </nav>

        <span>built on ape</span>
      </div>
    </footer>
  );
}

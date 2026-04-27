import { SOCIAL } from "@/lib/links";
import ArchiveLink from "./ArchiveLink";
import OpenseaLink from "./OpenseaLink";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-black/60 mt-8">
      <div className="max-w-[1200px] mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <span className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
          (c) the order &mdash; mmxxvi &mdash; do not redistribute
        </span>

        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xxs">
          <a href={SOCIAL.X} target="_blank" rel="noreferrer" className="hover-flicker">
            x ↗
          </a>
          <span className="text-mute">/</span>
          <a href={SOCIAL.DISCORD} target="_blank" rel="noreferrer" className="hover-flicker">
            discord ↗
          </a>
          <span className="text-mute">/</span>
          <a href={SOCIAL.APECHAIN} target="_blank" rel="noreferrer" className="hover-flicker">
            ape-chain ↗
          </a>
          <span className="text-mute">/</span>
          <OpenseaLink source="footer" className="hover-flicker">
            opensea ↗
          </OpenseaLink>
          <span className="text-mute">/</span>
          {/* Dead link — clicking flashes a 404 → "nothing is lost" → fade. */}
          <ArchiveLink className="text-xxs" />
        </nav>

        <span className="font-serif italic text-xxs text-bleed">
          built on ape.
        </span>
      </div>
    </footer>
  );
}

const X_URL = "https://x.com/SimianOrder";
const DISCORD_URL = "https://discord.gg/simian";
const APECHAIN_URL = "https://apechain.com";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-ape-900">
      <div className="max-w-[1200px] mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2 text-xxs uppercase tracking-widest text-mute">
        <span>(c) the order, mmxxvi</span>

        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="no-underline text-ape-300 hover:text-white hover-flicker"
          >
            x ↗
          </a>
          <span className="text-border">|</span>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="no-underline text-ape-300 hover:text-white hover-flicker"
          >
            discord ↗
          </a>
          <span className="text-border">|</span>
          <a
            href={APECHAIN_URL}
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

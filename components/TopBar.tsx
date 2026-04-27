"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ConnectWalletButton from "./ConnectWalletButton";
import OpenseaLink from "./OpenseaLink";

/**
 * Top navigation: replaces both the old TopBar AND the sidebar.
 * Layout is intentionally NOT symmetric:
 *   - logo offset slightly right of viewport edge,
 *   - scattered text-link nav with per-item rotation + y-jitter,
 *   - wallet button hangs off the far right with a slight tilt.
 *
 * Each nav item is a `nav-link` that gets cursor flicker + microjitter on
 * hover (defined in globals.css). The trailing `[???]` is a non-link
 * decorative element — looks like an unfinished route.
 */

type NavItem = {
  href: string;
  label: string;
  /** rotation in degrees */
  tilt: number;
  /** vertical offset in px — pushes some items up/down off the baseline */
  y: number;
  /** larger size for the visually-prominent items */
  big?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard",          label: "enter",    tilt: -1.2, y: 0 },
  { href: "/dashboard/apply",    label: "apply",    tilt:  1.4, y: -2, big: true },
  { href: "/dashboard/tasks",    label: "tasks",    tilt:  0.8, y: 2 },
  { href: "/dashboard/referral", label: "referral", tilt: -1.4, y: -1 },
];

export default function TopBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-black/70 sticky top-0 z-30">
      <div className="max-w-[1300px] mx-auto px-4 lg:px-6 pt-2 pb-2 flex items-end justify-between gap-3">
        {/* Left cluster: logo + scattered nav */}
        <div className="flex items-end gap-x-5 gap-y-2 flex-wrap pl-4 sm:pl-8">
          <div className="tilt-l hover-flicker">
            <Logo />
          </div>

          <nav className="flex items-end gap-x-3 sm:gap-x-5 gap-y-1 flex-wrap pb-[2px]">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "is-active" : ""} ${item.big ? "text-sm" : "text-xs"}`}
                  style={{
                    transform: `rotate(${item.tilt}deg) translateY(${item.y}px)`,
                  }}
                >
                  [{item.label}]
                </Link>
              );
            })}
            {/* External: secondary market on OpenSea — no public mint.
                Routed through <OpenseaLink> so the click triggers the
                dark glitch transition before opening the new tab. */}
            <OpenseaLink
              source="topbar"
              className="nav-link text-xs"
              style={{ transform: "rotate(2.4deg) translateY(-2px)" }}
            >
              [opensea ↗]
            </OpenseaLink>
          </nav>
        </div>

        {/* Right cluster: wallet + tiny system tag */}
        <div
          className="flex items-end gap-3 pr-2 sm:pr-6"
          style={{ transform: "rotate(0.8deg)" }}
        >
          <span className="hidden md:inline font-mono text-xxxs uppercase tracking-widest2 text-bleed pb-2">
            net: ape-main
          </span>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}

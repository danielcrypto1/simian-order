"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ConnectWalletButton from "./ConnectWalletButton";
import OpenseaLink from "./OpenseaLink";
import { OPENSEA_HIDDEN } from "@/lib/links";

/**
 * Top navigation. Two layouts driven by viewport:
 *
 *   - sm+ (≥640px): scattered text-link nav with per-item rotation + y-
 *     offset. Logo+nav left cluster, wallet right cluster. The desktop
 *     "underground/cult" look.
 *
 *   - mobile (<640px): single row with the logo on top, then a clean
 *     stacked-tap nav row below. No rotations, larger tap targets,
 *     wallet sits inline. Drops the desktop scatter so phones get an
 *     intentional layout, not a cramped desktop.
 */

type NavItem = {
  href: string;
  label: string;
  /** rotation in degrees (desktop only) */
  tilt: number;
  /** vertical offset in px (desktop only) */
  y: number;
  /** larger size for the visually-prominent items (desktop) */
  big?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard",          label: "enter",            tilt: -1.2, y: 0 },
  { href: "/dashboard/apply",    label: "high order",       tilt:  1.4, y: -2, big: true },
  { href: "/dashboard/tasks",    label: "tasks",            tilt:  0.8, y: 2 },
  { href: "/dashboard/referral", label: "five summoning",   tilt: -1.4, y: -1 },
];

export default function TopBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <header className="border-b border-border bg-black/70 sticky top-0 z-30">
      {/* TOP ROW — logo + (desktop) scattered nav + (always) wallet */}
      <div className="max-w-[1300px] mx-auto px-4 lg:px-6 pt-2 pb-2 flex items-end justify-between gap-3">
        <div className="flex items-end gap-x-5 gap-y-2 flex-wrap pl-2 sm:pl-8">
          <div className="tilt-l hover-flicker">
            <Logo />
          </div>

          {/* Desktop scattered nav — hidden on small screens to avoid
              the rotation chaos cramming into a phone column. */}
          <nav className="hidden sm:flex items-end gap-x-3 sm:gap-x-5 gap-y-1 flex-wrap pb-[2px]">
            {NAV.map((item) => {
              const active = isActive(item.href);
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
            {!OPENSEA_HIDDEN && (
              <OpenseaLink
                source="topbar"
                className="nav-link text-xs"
                style={{ transform: "rotate(2.4deg) translateY(-2px)" }}
              >
                [opensea ↗]
              </OpenseaLink>
            )}
          </nav>
        </div>

        {/* Right cluster: wallet button. The slight rotation is kept
            on desktop only — tilted clickable controls on touch read
            as broken. */}
        <div
          className="flex items-end gap-3 pr-1 sm:pr-6"
          style={{ transform: "rotate(0.8deg)" }}
        >
          <span className="hidden md:inline font-mono text-xxxs uppercase tracking-widest2 text-bleed pb-2">
            net: ape-main
          </span>
          <ConnectWalletButton />
        </div>
      </div>

      {/* MOBILE NAV — second row, stacked tap targets. Hidden on sm+
          where the scattered nav above takes over. */}
      <nav
        className="sm:hidden mobile-nav border-t border-border px-4"
        aria-label="primary navigation"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "is-active" : ""}
          >
            [{item.label}]
          </Link>
        ))}
        {!OPENSEA_HIDDEN && (
          <OpenseaLink source="topbar-mobile">
            [opensea ↗]
          </OpenseaLink>
        )}
      </nav>
    </header>
  );
}

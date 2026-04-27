"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/mockData";
import { SOCIAL } from "@/lib/links";

/**
 * @deprecated — kept for backwards-compat. The current AppShell has no
 * sidebar; navigation is scattered across the TopBar instead. This file is
 * retained so anything that still imports it compiles, but no route renders
 * it. Safe to delete once no callers remain.
 *
 * (Underground-style sidebar — text links, slight tilt, ASCII bullets.)
 */
export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="space-y-6 text-xxs">
      {/* Nav — text links, slight left tilt to break alignment */}
      <nav className="tilt-l">
        <div className="font-mono uppercase tracking-widest2 text-mute mb-2 text-xxxs">
          ── nav ──
        </div>
        <ul className="space-y-[2px]">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block no-underline font-mono uppercase tracking-wider2 text-xxs hover-flicker ${
                    active ? "text-bone" : "text-ape-200 hover:text-elec"
                  }`}
                >
                  <span className={active ? "text-bleed" : "text-mute"}>
                    {active ? "▮" : "·"}
                  </span>{" "}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Status — raw key/value, no panel */}
      <div>
        <div className="font-mono uppercase tracking-widest2 text-mute mb-2 text-xxxs">
          ── status ──
        </div>
        <ul className="font-mono space-y-[2px] text-bone">
          <li className="flex justify-between">
            <span className="text-mute">phase</span>
            <span>apply</span>
          </li>
          <li className="flex justify-between">
            <span className="text-mute">round</span>
            <span>II</span>
          </li>
          <li className="flex justify-between">
            <span className="text-mute">tier</span>
            <span className="text-elec">primate</span>
          </li>
          <li className="flex justify-between">
            <span className="text-mute">gate</span>
            <span className="text-bleed pulse-soft">open</span>
          </li>
        </ul>
      </div>

      {/* External — text links with arrow markers */}
      <div className="tilt-r">
        <div className="font-mono uppercase tracking-widest2 text-mute mb-2 text-xxxs">
          ── elsewhere ──
        </div>
        <ul className="space-y-[2px] font-mono">
          <li>
            <a
              href={SOCIAL.X}
              target="_blank"
              rel="noopener noreferrer"
              className="hover-flicker"
            >
              x.com/simianorder ↗
            </a>
          </li>
          <li>
            <a
              href={SOCIAL.DISCORD}
              target="_blank"
              rel="noopener noreferrer"
              className="hover-flicker"
            >
              discord ↗
            </a>
          </li>
          <li>
            <a
              href={SOCIAL.APECHAIN}
              target="_blank"
              rel="noopener noreferrer"
              className="hover-flicker"
            >
              apechain.com ↗
            </a>
          </li>
          <li>
            <a
              href={SOCIAL.OPENSEA}
              target="_blank"
              rel="noopener noreferrer"
              className="hover-flicker"
            >
              opensea / floor ↗
            </a>
          </li>
        </ul>
      </div>

      {/* Whisper — italic serif, decorative */}
      <p className="italic font-serif text-mute text-xs leading-tight pl-2 border-l border-border">
        the simians do not advertise. they wait.
      </p>
    </aside>
  );
}

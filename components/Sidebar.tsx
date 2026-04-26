"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/mockData";
import Panel from "./Panel";

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="space-y-3">
      <Panel title="Navigation" padded={false}>
        <ul>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-3 py-1 no-underline border-l-2 ${
                    active
                      ? "bg-ape-800 border-ape-300 text-white"
                      : "border-transparent text-ape-200 hover:bg-ape-850 hover:border-ape-500"
                  }`}
                >
                  &gt; {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Status">
        <ul className="text-xxs space-y-1">
          <li className="flex justify-between"><span className="text-mute">phase</span><span className="text-ape-100">apply</span></li>
          <li className="flex justify-between"><span className="text-mute">round</span><span className="text-ape-100">II</span></li>
          <li className="flex justify-between"><span className="text-mute">tier</span><span className="text-ape-100">primate</span></li>
        </ul>
      </Panel>

      <Panel title="Links">
        <ul className="space-y-1 text-xxs">
          <li>&middot; <a href="#">x.com/SimianOrder</a></li>
          <li>&middot; <a href="#">discord.gg/simian</a></li>
          <li>&middot; <a href="#">apechain.com</a></li>
          <li>&middot; <a href="#">opensea / floor</a></li>
        </ul>
      </Panel>
    </aside>
  );
}

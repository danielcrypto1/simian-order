"use client";

import Panel from "./Panel";

/**
 * @deprecated — replaced by `TerminalBar` (top live-status strip) and
 * `FloatingScatter` (right-edge floating notice + links). The current
 * AppShell does not render this. File kept so any stray imports still
 * compile; safe to delete once nothing references it.
 */

const MAX_SUPPLY = 5555;

export default function RightPanel() {
  return (
    <aside className="space-y-4">
      <Panel title="collection">
        <ul className="font-mono text-xxs space-y-2">
          <li className="flex justify-between">
            <span className="text-mute">supply</span>
            <span className="text-bone">{MAX_SUPPLY.toLocaleString()}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-mute">chain</span>
            <span className="text-bone">ape-chain</span>
          </li>
        </ul>
      </Panel>

      {/* Notice — looks like a stuck post-it */}
      <div className="relative tilt-r2 pl-3 pr-2 py-2 border border-bleed bg-black/70">
        <div className="absolute -top-2 left-2 sticker">notice</div>
        <p className="font-serif italic text-xs text-ape-200 leading-snug pt-2">
          The order is silent. The simians are watching.
          Enter the HIGH ORDER before the gate closes.
        </p>
      </div>
    </aside>
  );
}

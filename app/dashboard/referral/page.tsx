"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";
import { TWEETS, openTweet } from "@/lib/twitterShare";
import OpenseaLink from "@/components/OpenseaLink";
import { useRound } from "@/lib/useRound";

/**
 * Referral page — restyled as an "access" dossier, not a marketing feature.
 *
 * Functional contract preserved:
 *   - only `applicationStatus === "approved"` may refer (lock screen otherwise)
 *   - max 5 referrals, server enforced
 *   - link encodes the user's referral code
 *   - share-on-X, copy-link
 *
 * Visual rewrite:
 *   - inline lock state ("ACCESS DENIED")
 *   - slot strip with 5 hand-drawn-feeling circles, lit on use
 *   - terminal-style link block with > prefix
 *   - text-link actions only — no buttons
 *   - subtle "one has entered" notification on count delta
 *   - log replaces the table (no badges, no gamification stats)
 */

type ReferredEntry = {
  wallet: string;
  handle: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string | null;
};

type ReferralData = {
  wallet: string;
  code: string;
  count: number;
  limit: number;
  referred: ReferredEntry[];
};

// Hand-drawn-feeling irregular border-radii for the slot circles.
const SLOT_RADII = [
  "51% 49% 53% 47% / 49% 53% 47% 51%",
  "47% 53% 49% 51% / 51% 47% 53% 49%",
  "53% 47% 51% 49% / 47% 51% 49% 53%",
  "49% 51% 47% 53% / 53% 49% 51% 47%",
  "52% 48% 50% 50% / 48% 52% 50% 50%",
];
const SLOT_TILTS = [-3, 1.5, -1.2, 2.4, -2];

export default function ReferralPage() {
  const hasHydrated = useStore((s) => s._hasHydrated);
  const applicationStatus = useStore((s) => s.applicationStatus);
  const { address } = useWallet();
  const round = useRound();

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // "one has entered" — fades in when the server count rises since last render.
  const prevCountRef = useRef<number>(-1);
  const [pulse, setPulse] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/referral?wallet=${address}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `http_${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  // Detect new entries (count went up) and trigger the subtle pulse.
  useEffect(() => {
    if (!data) return;
    const prev = prevCountRef.current;
    if (prev !== -1 && data.count > prev) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 6000);
      return () => clearTimeout(id);
    }
    prevCountRef.current = data.count;
  }, [data]);

  const link = data?.code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${data.code}`
    : "";

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("clipboard_unavailable");
    }
  }, [link]);

  // ── HYDRATION GUARD ───────────────────────────────────────────────────
  if (!hasHydrated) {
    return (
      <p className="font-mono text-xxs text-mute uppercase tracking-widest2">
        &gt; restoring session<span className="blink">_</span>
      </p>
    );
  }

  // ── LOCK STATE — ACCESS DENIED ───────────────────────────────────────
  if (applicationStatus !== "approved") {
    return (
      <div className="max-w-[640px] tilt-l">
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed mb-2">
          ── status / 401 ──
        </p>
        <h1 className="headline text-5xl sm:text-6xl text-bleed mb-3">
          access denied<span className="blink">.</span>
        </h1>
        <p className="font-serif italic text-base text-ape-200 mb-8">
          you are not permitted to invite.
        </p>
        <div className="divider-glitch max-w-[280px] mb-8" aria-hidden />
        <p className="font-mono text-xs text-mute leading-relaxed mb-6">
          referrals are reserved for those the order has already recognised.
          file an application. wait. the simians are not in a hurry.
        </p>
        <a href="/dashboard/apply" className="text-link">
          &gt; open application
        </a>
      </div>
    );
  }

  const count = data?.count ?? 0;
  const limit = data?.limit ?? 5;
  const remaining = Math.max(0, limit - count);
  const slots = Array.from({ length: limit }, (_, i) => i < count);

  return (
    <div className="max-w-[680px] space-y-10">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header>
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-elec mb-2">
          ── status / 200 / clearance ──
        </p>
        <h1 className="headline text-5xl sm:text-6xl mb-2">
          access granted<span className="blink text-bleed">.</span>
        </h1>
        <p className="font-serif italic text-base text-ape-200 mb-2">
          you have been given limited authority.
        </p>
        {/* Round-bound access tag — small, mono caps, electric blue.
            Updates live when admin bumps the round. */}
        <p className="font-mono text-xxs uppercase tracking-widest2 text-elec">
          // round {round ?? "—"} access
        </p>

        {/* Round-bound entry pulse — fades in when a new referral lands.
            Includes the active round so the timestamp on the entry is
            unambiguous in the moment AND in screenshots. */}
        {pulse && (
          <p className="reveal mt-4 font-mono text-xs uppercase tracking-widest2 text-bleed">
            &gt; they have entered &mdash; round {round ?? "—"}
          </p>
        )}
      </header>

      <div className="divider-glitch" aria-hidden />

      {/* ── SLOTS ──────────────────────────────────────────────────── */}
      <section>
        {/* Round-bound directive — ties the 5 slots to the active round so
            referees stamped this round are visually associated with it. */}
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-3">
          ── you can select 5 for round {round ?? "—"} ──
        </p>

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap mb-4">
          {slots.map((filled, i) => (
            <Slot key={i} filled={filled} index={i} />
          ))}
        </div>

        <p className="font-mono text-sm uppercase tracking-widest2 text-bone">
          {remaining} / {limit}{" "}
          <span className="text-mute">remain</span>
        </p>
        <p className="font-serif italic text-sm text-mute mt-1">
          choose carefully.
        </p>

        {/* Hidden message — only when all five slots are spent. */}
        {remaining === 0 && limit > 0 && (
          <p
            className="reveal mt-4 t-display italic text-2xl sm:text-3xl text-bleed"
            style={{ transform: "rotate(-0.6deg)" }}
          >
            you have influence<span className="blink">.</span>
          </p>
        )}
      </section>

      {/* ── LINK ───────────────────────────────────────────────────── */}
      <section>
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-3">
          ── your link ──
        </p>

        {!address ? (
          <p className="font-mono text-xs text-mute">
            &gt; connect a wallet to retrieve your link.
          </p>
        ) : error ? (
          <p className="font-mono text-xs text-bleed">
            &gt; error: {error}
          </p>
        ) : !data || loading ? (
          <p className="font-mono text-xs text-mute">
            &gt; resolving<span className="blink">_</span>
          </p>
        ) : (
          <>
            {/* Terminal-style block — > prefixed, mono, no field chrome */}
            <div className="font-mono text-sm leading-snug pl-3 border-l border-elec">
              <p className="text-mute">&gt; your link:</p>
              <p className="text-bone break-all selection:bg-elec selection:text-black">
                &gt;&nbsp;{link.replace(/^https?:\/\//, "")}
              </p>
              <p className="text-mute mt-1">
                &gt; code:{" "}
                <span className="text-elec">{data.code}</span>
              </p>
            </div>

            {/* Minimal text-link actions, no buttons */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 items-center">
              <button
                type="button"
                onClick={copy}
                className="text-link"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              >
                [ {copied ? "copied" : "copy"} ]
              </button>
              <button
                type="button"
                onClick={() => openTweet(TWEETS.referral(link))}
                className="text-link"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              >
                [ share signal ]
              </button>
            </div>
          </>
        )}
      </section>

      <div className="divider-noise" aria-hidden />

      {/* ── MARKETPLACE POINTER ────────────────────────────────────── */}
      {/* Subtle reminder that the secondary market exists. Small, quiet,
          opens in a new tab. Not the focus of this page. */}
      <p className="font-mono text-xxs uppercase tracking-widest2 text-mute -mt-2">
        // secondary market live —{" "}
        <OpenseaLink source="referral" className="text-link">
          [ view on opensea ↗ ]
        </OpenseaLink>
      </p>

      {/* ── ENTRY LOG ──────────────────────────────────────────────── */}
      <section>
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-3">
          ── log / those who entered ──
        </p>

        {!data || data.referred.length === 0 ? (
          <p className="font-serif italic text-sm text-mute">
            &mdash; no one yet. the door is heavy.
          </p>
        ) : (
          <ul className="font-mono text-xs space-y-[3px]">
            {data.referred.map((u) => (
              <LogLine key={u.wallet} entry={u} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * A single referral slot — filled circles glow, empty circles are dashed
 * outlines. Each slot has its own irregular border-radius and tilt so the
 * row never looks machine-perfect.
 */
function Slot({ filled, index }: { filled: boolean; index: number }) {
  const radius = SLOT_RADII[index % SLOT_RADII.length];
  const tilt = SLOT_TILTS[index % SLOT_TILTS.length];

  return (
    <div
      aria-label={filled ? "slot used" : "slot open"}
      className="relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14"
      style={{
        borderRadius: radius,
        transform: `rotate(${tilt}deg)`,
        background: filled ? "#0040ff" : "transparent",
        border: filled ? "1px solid #ff2d2d" : "1px dashed #1a1a28",
        boxShadow: filled
          ? "0 0 14px rgba(0,64,255,0.55), inset 0 0 6px rgba(0,0,0,0.6)"
          : "none",
        transition: "background 200ms ease, box-shadow 200ms ease",
      }}
    >
      {filled && (
        <span
          className="block w-2 h-2"
          style={{
            borderRadius: "49% 51% 47% 53% / 51% 49% 53% 47%",
            background: "#fff",
            boxShadow: "0 0 6px #fff",
          }}
        />
      )}
    </div>
  );
}

/**
 * Single entry line in the log. No badges, no table chrome — just
 * `> 0xabc...123 — handle — date — status` in courier mono with a
 * minimal color cue per status.
 */
function LogLine({ entry }: { entry: ReferredEntry }) {
  const statusClass =
    entry.status === "approved"
      ? "text-elec"
      : entry.status === "rejected"
      ? "text-bleed"
      : "text-bone";
  const wallet =
    entry.wallet.length > 12
      ? `${entry.wallet.slice(0, 6)}…${entry.wallet.slice(-4)}`
      : entry.wallet;
  const date = entry.submittedAt?.slice(0, 10) ?? "—";
  return (
    <li className="row-hover px-1">
      <span className="text-mute">&gt;&nbsp;</span>
      <span className="text-bone">{wallet}</span>
      <span className="text-mute"> &mdash; </span>
      <span className="text-bone">{entry.handle ?? "anonymous"}</span>
      <span className="text-mute"> &mdash; </span>
      <span className="text-mute">{date}</span>
      <span className="text-mute"> &mdash; </span>
      <span className={statusClass}>{entry.status}</span>
    </li>
  );
}

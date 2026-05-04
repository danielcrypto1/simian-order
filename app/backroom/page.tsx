"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SOCIAL } from "@/lib/links";

/**
 * /backroom — hidden 500-claim easter egg.
 *
 * Reachable only by direct URL. Asks "WHAT'S THE CODE." When the
 * visitor types the active passphrase (set by admin), the server
 * mints a unique XXXX-XXXX combination code, binds it to the
 * visitor's httpOnly cookie, and returns it. One claim per cookie;
 * once 500 codes are issued, the page renders ACCESS CLOSED.
 *
 * Visual rules: pure black, no chrome, mono caps, slight tilt. No
 * topbar, no footer (the parent layout omits both via the segment
 * being a sibling of /dashboard).
 */

type Status = {
  total: number;
  remaining: number;
  full: boolean;
  passphraseSet: boolean;
  claimed: { code: string; claimedAt: string } | null;
};

export default function BackroomPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [wallet, setWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/backroom", {
        cache: "no-store",
        credentials: "include",
      });
      if (r.ok) {
        const j = (await r.json()) as Status;
        setStatus(j);
        if (j.claimed) setIssuedCode(j.claimed.code);
      }
    } catch { /* offline — leave loading state */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!loading && !issuedCode && !status?.full && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, issuedCode, status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("speak the code.");
      return;
    }
    const w = wallet.trim();
    if (!w) {
      setError("wallet required.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(w)) {
      setError("invalid wallet — paste a 0x… ape-chain address.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/backroom/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim(), wallet: w }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setIssuedCode(j.code as string);
        setStatus((s) =>
          s ? { ...s, remaining: j.remaining, full: j.remaining <= 0, claimed: { code: j.code, claimedAt: j.claimedAt } } : s
        );
        return;
      }
      const errCode = j.error as string | undefined;
      if (errCode === "wrong_code") setError("incorrect.");
      else if (errCode === "full") setError("access closed.");
      else if (errCode === "no_passphrase_set") setError("the door is sealed for now.");
      else if (errCode === "rate_limited") setError("too many attempts. wait a moment.");
      else if (errCode === "missing_wallet") setError("wallet required.");
      else if (errCode === "invalid_wallet") setError("invalid wallet — paste a 0x… ape-chain address.");
      else if (errCode === "wallet_already_claimed") setError("that wallet already holds a code.");
      else setError("rejected.");
      // Refresh status in case full just flipped.
      refresh();
    } catch {
      setError("network error.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render branches ──────────────────────────────────────────────

  if (loading) {
    return (
      <Frame>
        <p className="font-mono text-xxs text-mute uppercase tracking-widest2">
          &gt; resolving<span className="blink">_</span>
        </p>
      </Frame>
    );
  }

  if (issuedCode) {
    return (
      <Frame>
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-elec mb-3">
          ── status / 200 / granted ──
        </p>
        <h1 className="t-display italic text-[40px] sm:text-7xl leading-none mb-4 text-bone tilt-l">
          access granted<span className="blink text-bleed">.</span>
        </h1>
        <p className="font-serif italic text-base text-ape-200 mb-6">
          the door is open. once.
        </p>

        <div className="my-6">
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-2">
            ── your code ──
          </p>
          <div
            className="font-mono text-3xl sm:text-5xl tracking-[0.18em] text-bleed select-all py-2"
            aria-label="your back room combination code"
          >
            {issuedCode}
          </div>
        </div>

        <div className="divider-glitch max-w-[280px] my-6" aria-hidden />

        <ol className="font-mono text-xs sm:text-sm text-ape-100 space-y-2 leading-relaxed">
          <li>
            <span className="text-mute">01.</span>{" "}
            join our discord —{" "}
            <a
              href={SOCIAL.DISCORD}
              target="_blank"
              rel="noopener noreferrer"
              className="text-elec underline hover:text-bone"
            >
              {SOCIAL.DISCORD.replace(/^https?:\/\//, "")}
            </a>
          </li>
          <li>
            <span className="text-mute">02.</span>{" "}
            submit this code in discord to access the server.
          </li>
        </ol>

        {status && (
          <p className="mt-8 font-mono text-xxs uppercase tracking-widest2 text-mute">
            // remaining: {status.remaining} / {status.total}
          </p>
        )}
      </Frame>
    );
  }

  if (status?.full) {
    return (
      <Frame>
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed mb-3">
          ── status / 423 / locked ──
        </p>
        <h1 className="t-display italic text-[40px] sm:text-7xl leading-none mb-4 text-bleed tilt-r">
          access closed<span className="blink">.</span>
        </h1>
        <p className="font-serif italic text-base text-ape-200">
          all 500 keys have been claimed. the door is shut.
        </p>
        <p className="mt-8 font-mono text-xxs uppercase tracking-widest2 text-mute">
          // remaining: 0 / {status.total}
        </p>
      </Frame>
    );
  }

  // Default: prompt for the code.
  return (
    <Frame>
      <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed mb-3">
        ── /backroom ── access depth: ?? ──
      </p>
      <h1 className="t-display italic text-[40px] sm:text-7xl leading-none mb-4 tilt-l">
        what&rsquo;s the code<span className="blink text-bleed">.</span>
      </h1>
      <p className="font-serif italic text-base text-ape-200 mb-8">
        speak it. one chance per visitor.
      </p>

      <form onSubmit={submit} className="space-y-3 max-w-[480px]">
        <input
          ref={inputRef}
          type="text"
          className="field font-mono text-base"
          placeholder="enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={128}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="back room code"
        />
        <input
          type="text"
          className="field font-mono text-base"
          placeholder="wallet address (0x…)"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          maxLength={64}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-label="ape-chain wallet address"
        />
        <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
          // wallet binds the code. one wallet, one entry.
        </p>
        {error && (
          <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200 uppercase tracking-wide">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="text-link"
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          [ {submitting ? "checking…" : "knock"} ]
        </button>
      </form>

      {status && (
        <p className="mt-12 font-mono text-xxs uppercase tracking-widest2 text-mute">
          // remaining: {status.remaining} / {status.total}
        </p>
      )}
    </Frame>
  );
}

/** Black, chrome-less frame matching /void aesthetic. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen w-screen overflow-hidden bg-black text-bone select-none">
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-16">
        <div className="max-w-[640px] w-full">{children}</div>
      </div>
      <div className="absolute top-2 left-3 font-mono text-xxxs uppercase tracking-widest2 text-bleed pointer-events-none">
        // /backroom &mdash; no record kept
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-xxxs uppercase tracking-widest2 text-mute pointer-events-none">
        knock once
      </div>
    </main>
  );
}

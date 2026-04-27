"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import MediaBackground from "@/components/MediaBackground";
import SimianCharacter from "@/components/SimianCharacter";
import DelayedLink from "@/components/DelayedLink";
import OpenseaLink from "@/components/OpenseaLink";
import { useRound } from "@/lib/useRound";

/**
 * SIMIAN ORDER — entry gate.
 *
 * Fully layered composition (back → front):
 *   L1: <MediaBackground />            — chaos image + grain + streaks overlay
 *   L2: edge characters                — variant 2/3 partial-cut bleeders
 *   L3: central drifting cluster       — variant 1 main + 2 ghost copies
 *   L4: text + entry-link nav          — title overlaps the central character
 *   L5: chrome (top tags, audio, etc.) — pinned to corners
 *   L6: cursor-halo                    — follows pointer above everything
 *
 * Hidden interaction:
 *   - clicking the stage (not on a link) triggers shudder + RGB-split.
 *   - clicking [ ??? ] reveals an extra red door link.
 *   - 5+ clicks reveals a center-bottom whisper.
 */
export default function LandingPage() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [doorOpen, setDoorOpen] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const round = useRound();

  // (Cursor halo lives in the global InteractionLayer — no duplicate here.)

  // ── Click → shudder + rgb-split on the title ──────────────────────────
  const triggerGlitch = useCallback(() => {
    const t = titleRef.current;
    const s = stageRef.current;
    if (t) {
      t.classList.remove("rgbsplit");
      void t.offsetWidth;
      t.classList.add("rgbsplit");
    }
    if (s) {
      s.classList.remove("shudder");
      void s.offsetWidth;
      s.classList.add("shudder");
    }
  }, []);

  const onStageClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button") || target.closest("[data-no-glitch]")) return;
      triggerGlitch();
      setClicks((c) => c + 1);
    },
    [triggerGlitch]
  );

  // ── Hidden door ───────────────────────────────────────────────────────
  const onMystery = useCallback(() => {
    triggerGlitch();
    setDoorOpen((d) => !d);
    track("landing_mystery_click");
  }, [triggerGlitch]);

  // ── Optional ambient drone via Web Audio API ──────────────────────────
  const toggleAudio = useCallback(() => {
    if (audioOn) {
      const a = audioRef.current;
      if (a) {
        try {
          const t = a.ctx.currentTime;
          a.gain.gain.cancelScheduledValues(t);
          a.gain.gain.linearRampToValueAtTime(0, t + 0.4);
          setTimeout(() => { a.ctx.close().catch(() => {}); }, 500);
        } catch { /* noop */ }
      }
      audioRef.current = null;
      setAudioOn(false);
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);

      const o1 = ctx.createOscillator();
      o1.type = "sine"; o1.frequency.value = 55;
      o1.connect(gain); o1.start();

      const o2 = ctx.createOscillator();
      o2.type = "triangle"; o2.frequency.value = 82.4;
      const o2g = ctx.createGain(); o2g.gain.value = 0.5;
      o2.connect(o2g).connect(gain); o2.start();

      const lfo = ctx.createOscillator();
      lfo.type = "sine"; lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain).connect(gain.gain); lfo.start();

      gain.gain.linearRampToValueAtTime(0.038, ctx.currentTime + 0.8);

      audioRef.current = { ctx, gain };
      setAudioOn(true);
      track("landing_audio_on");
    } catch { /* noop */ }
  }, [audioOn]);

  useEffect(() => {
    return () => { audioRef.current?.ctx.close().catch(() => {}); };
  }, []);

  // ── Referral capture ─────────────────────────────────────────────────
  // Links shared from the referral page use `?ref=CODE`. Capture once on
  // mount and stash in sessionStorage so the apply page can prefill the
  // referrer field, regardless of which page the visitor lands on next.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref) {
        sessionStorage.setItem("simian_ref", ref.toUpperCase().slice(0, 32));
      }
    } catch { /* SSR or storage blocked — skip silently */ }
  }, []);

  return (
    <main
      ref={stageRef}
      onClick={onStageClick}
      className="entry-gate relative h-screen w-screen overflow-hidden bg-black text-bone select-none"
    >
      {/* (cursor halo provided by global InteractionLayer) */}

      {/* L1 — full-bleed photo backdrop + chaos SVG + glitch.png on top */}
      <MediaBackground
        photo
        variant={1}
        overlay="streaks"
        glitchPng
        opacity={0.45}
        blur={2}
      />

      {/* L2 — edge characters: real character.png peeks in from edges */}

      {/* Top-right — character.png peeking down, cut at top+right */}
      <SimianCharacter
        variant={4}
        position="top-right"
        opacity={0.55}
        blur={1}
        size="26vw"
        rotate={6}
        className="cut-edge-right cut-edge-top"
      />

      {/* Bottom-left — character.png crouched, partially cut */}
      <SimianCharacter
        variant={4}
        position="bottom-left"
        opacity={0.40}
        blur={0}
        size="32vw"
        rotate={-4}
        className="cut-edge-bottom cut-edge-left"
      />

      {/* L3 — VOID central character with ghost duplicates */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
        <div className="relative w-[460px] h-[520px] sm:w-[580px] sm:h-[640px] -ml-2 sm:-ml-10">
          {/* Ghost clones drifting behind — lazy-loaded since they're
              decorative duplicates of the focal point. */}
          <img
            src="/media/void.png"
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain ghost-l"
            style={{ opacity: 0.12, filter: "blur(8px)" }}
          />
          <img
            src="/media/void.png"
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain ghost-r"
            style={{ opacity: 0.18, filter: "blur(4px)" }}
          />
          {/* Main void character — eager (it IS the focal point) */}
          <img
            src="/media/void.png"
            alt="void"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain ghost-c"
            style={{
              opacity: 0.95,
              filter: "drop-shadow(0 0 38px rgba(0,64,255,0.45))",
            }}
          />
        </div>
      </div>

      {/* Glitch overlay band across the central section */}
      <div className="glitch-overlay glitch-overlay--mid" aria-hidden />
      <div className="glitch-overlay glitch-overlay--bottom glitch-overlay--low" aria-hidden />

      {/* L4 — text + actions, overlapping the central character on purpose */}
      <div className="absolute inset-0 flex flex-col items-start justify-center pl-6 sm:pl-16 lg:pl-32 pr-4 pointer-events-none z-[2]">
        <div className="max-w-[720px] pointer-events-auto" data-no-glitch>
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-2 tilt-l">
            ── you weren&rsquo;t supposed to find this ──
          </p>

          <h1
            ref={titleRef}
            className="t-display italic t-split text-6xl sm:text-7xl md:text-8xl leading-[0.85] mb-4 t-shift"
            style={{ wordSpacing: "-0.04em" }}
          >
            simian
            <br />
            <span className="text-elec">order</span>
            <span className="blink text-bleed">.</span>
          </h1>

          <p className="t-accent text-2xl sm:text-3xl tracking-widest text-bone mb-3 tilt-r t-shift-2">
            ENTRY IS EARNED.
          </p>

          {/* Round indicator — small caps mono caption, intentionally
              quiet. Updates live via the shared useRound poll. */}
          <p className="font-mono text-xxs uppercase tracking-widest2 text-elec mb-2">
            // round {round ?? "—"} active
          </p>

          <p className="font-serif italic text-base sm:text-lg text-ape-200 mb-2 tilt-l t-blur">
            you don&rsquo;t join. you align.
          </p>

          {/* Glitch streak between whisper and links — uses Glitch.png stretched */}
          <div className="section-glitch max-w-[280px] mb-4" aria-hidden />

          <nav className="flex flex-wrap items-baseline gap-x-7 gap-y-3" aria-label="entry">
            {/* DelayedLink — 150ms beat between click and navigation. */}
            <DelayedLink
              href="/dashboard"
              delay={170}
              onClick={() => track("landing_enter_click")}
              className="entry-link text-base sm:text-lg"
              style={{ transform: "rotate(-0.6deg)" }}
            >
              [ enter ]
            </DelayedLink>
            <DelayedLink
              href="/dashboard/apply"
              delay={170}
              onClick={() => track("landing_apply_click")}
              className="entry-link text-base sm:text-lg"
              style={{ transform: "rotate(0.8deg) translateY(-2px)" }}
            >
              [ apply ]
            </DelayedLink>
            <button
              type="button"
              onClick={onMystery}
              className="entry-link text-base sm:text-lg cursor-help"
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px dotted rgba(232,232,232,0.35)",
                transform: "rotate(-1.2deg) translateY(2px)",
                color: doorOpen ? "#ff2d2d" : undefined,
              }}
              aria-expanded={doorOpen}
              title="?"
            >
              [ {doorOpen ? "·" : "???"} ]
            </button>

            {doorOpen && (
              <DelayedLink
                href="/void"
                delay={200}
                onClick={() => track("landing_door_open")}
                className="entry-link reveal text-base sm:text-lg text-bleed"
                style={{ transform: "rotate(1.4deg) translateY(-1px)" }}
              >
                [ → the back room ]
              </DelayedLink>
            )}

            {/* Secondary market — opens OpenSea in a new tab via
                <OpenseaLink>, which runs the glitch exit sequence first. */}
            <OpenseaLink
              source="landing"
              className="entry-link text-base sm:text-lg"
              style={{ transform: "rotate(0.6deg) translateY(1px)" }}
            >
              [ view on opensea ↗ ]
            </OpenseaLink>
          </nav>

          {/* "no public mint" caption — clarifies the door is closed. */}
          <p className="mt-4 font-mono text-xxxs uppercase tracking-widest2 text-mute t-blur">
            // no public mint &mdash; secondary market live &mdash; entry continues there.
          </p>

          <p className="mt-12 font-mono text-xxxs uppercase tracking-widest2 text-mute">
            // last entered: 04:12:33 utc &nbsp;·&nbsp; 3333 &nbsp;·&nbsp; ape-chain
            {clicks > 0 && (
              <>
                {" "}&nbsp;·&nbsp;{" "}
                <span className="text-bleed">stutter:{clicks}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* L5 — atmospheric chrome */}

      <div className="absolute top-2 left-3 font-mono text-xxxs uppercase tracking-widest2 text-mute pointer-events-none z-[3]">
        // /index &mdash; restricted
      </div>

      <div className="absolute top-2 right-3 font-mono text-xxxs uppercase tracking-widest2 text-mute pointer-events-none tilt-r z-[3]">
        v0.0.1 &mdash; <span className="text-bleed">alpha</span>
      </div>

      <div
        className="absolute bottom-3 right-3 flex items-center gap-3 font-mono text-xxs z-[3]"
        data-no-glitch
      >
        <button
          type="button"
          onClick={toggleAudio}
          className="text-mute hover:text-bone uppercase tracking-widest2 text-xxxs"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          aria-pressed={audioOn}
        >
          [ {audioOn ? "♪ on" : "♪ off"} ]
        </button>
        <a
          href="https://apechain.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif italic text-xxs text-mute hover:text-elec no-underline"
        >
          built on apechain ↗
        </a>
      </div>

      {clicks >= 5 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 reveal pointer-events-none z-[3]">
          <p className="font-serif italic text-xs text-bleed text-center">
            stop knocking. the simians can hear you.
          </p>
        </div>
      )}
    </main>
  );
}

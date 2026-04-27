"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Global interaction layer — single client component mounted once at the
 * root of the document. Owns:
 *
 *   1. Cursor halo (soft electric-blue glow following the pointer)
 *   2. Click flash  (radial pulse centered on the click point, ~140ms)
 *   3. Rare glitch  (every 90-180s a body-level hue/translate twitch,
 *                    sometimes accompanied by a fleeting "observed" word)
 *   4. Parallax     (scroll → CSS var --scroll-y, consumed by MediaBackground)
 *   5. First-load splash ("connecting…" → "aligned." → fade)
 *   6. Secret "simian" keyboard command → "alignment detected" reveal
 *
 * Each effect is independently cancellable, compositor-only, and respects
 * prefers-reduced-motion via CSS rules already declared in globals.css.
 *
 * Mounting once at the layout root guarantees these effects run consistently
 * across landing, dashboard, admin pages — no per-page wiring required.
 */
export default function InteractionLayer() {
  const haloRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  // Splash: stage transitions on first load only.
  const [splashStage, setSplashStage] =
    useState<"hidden" | "connecting" | "aligned" | "fading">("hidden");

  // Hidden message overlays (mutually independent).
  const [alignment, setAlignment] = useState(false);
  const [observed, setObserved] = useState(false);

  // Night-mode flag — true between 00:00 and 04:00 local.
  const [nightMode, setNightMode] = useState(false);

  // ── 5. First-load splash (sessionStorage-gated so it fires once) ────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("simian_splash_seen")) return;
    sessionStorage.setItem("simian_splash_seen", "1");

    setSplashStage("connecting");
    const t1 = setTimeout(() => setSplashStage("aligned"), 480);
    const t2 = setTimeout(() => setSplashStage("fading"), 820);
    const t3 = setTimeout(() => setSplashStage("hidden"), 1240);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // ── 1. Cursor halo (rAF-throttled pointermove) ──────────────────────
  useEffect(() => {
    const halo = haloRef.current;
    if (!halo) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let raf = 0;
    let pending = false;

    const apply = () => {
      pending = false;
      halo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!pending) {
        pending = true;
        raf = requestAnimationFrame(apply);
      }
    };
    const onEnter = () => { halo.style.opacity = "1"; };
    const onLeave = () => { halo.style.opacity = "0"; };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerenter", onEnter);
    window.addEventListener("pointerleave", onLeave);
    apply();

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerenter", onEnter);
      window.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── 2. Click flash — radial pulse centered on click position ────────
  useEffect(() => {
    const flash = flashRef.current;
    if (!flash) return;

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // Allow opt-out via [data-no-flash] for elements that already do their
      // own click feedback (e.g. landing's title shudder).
      if (t.closest("[data-no-flash]")) return;
      flash.style.setProperty("--cx", `${e.clientX}px`);
      flash.style.setProperty("--cy", `${e.clientY}px`);
      flash.classList.remove("active");
      // Force reflow so the animation can replay.
      void flash.offsetWidth;
      flash.classList.add("active");
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // ── 3. Rare glitch — fires once every 90-180s. ~30% of the time it
  //       also flashes the word "observed" briefly above the cursor. ───
  useEffect(() => {
    let id = 0;
    const fire = () => {
      document.body.classList.add("rare-glitch");
      window.setTimeout(() => document.body.classList.remove("rare-glitch"), 220);
      // Observed-flash: rare bonus.
      if (Math.random() < 0.30) {
        setObserved(true);
        window.setTimeout(() => setObserved(false), 1700);
      }
    };
    const schedule = () => {
      const ms = 90_000 + Math.random() * 90_000; // 90s..180s
      id = window.setTimeout(() => { fire(); schedule(); }, ms);
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  // ── Night mode — local time 00:00-04:00 ⇒ body.night-mode + low-signal
  //       Re-evaluated every 60s so a session crossing the boundary
  //       picks up the change without a refresh.
  useEffect(() => {
    const evaluate = () => {
      const h = new Date().getHours();
      const isNight = h >= 0 && h < 4;
      setNightMode(isNight);
      document.body.classList.toggle("night-mode", isNight);
    };
    evaluate();
    const id = window.setInterval(evaluate, 60_000);
    return () => {
      window.clearInterval(id);
      document.body.classList.remove("night-mode");
    };
  }, []);

  // ── 6. Secret keyboard command — typing "simian" anywhere triggers
  //       the alignment-detected overlay. Skips if focus is on an
  //       editable element so it can't fire while typing in forms. ────
  useEffect(() => {
    let buffer = "";
    const SECRET = "simian";
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key.length !== 1) return;          // ignore non-printable
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-SECRET.length);
      if (buffer === SECRET) {
        // Trigger the overlay + a one-shot rare-glitch on body.
        document.body.classList.add("rare-glitch");
        window.setTimeout(() => document.body.classList.remove("rare-glitch"), 220);
        setAlignment(true);
        window.setTimeout(() => setAlignment(false), 2400);
        track("secret_simian");
        buffer = ""; // reset so a single re-type re-triggers
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── 4. Parallax — pushes scrollY into a CSS variable on body ────────
  useEffect(() => {
    let raf = 0;
    let pending = false;
    const apply = () => {
      pending = false;
      document.body.style.setProperty("--scroll-y", `${window.scrollY}px`);
    };
    const onScroll = () => {
      if (!pending) {
        pending = true;
        raf = requestAnimationFrame(apply);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Cursor halo. Hidden on touch devices via media query in globals.css. */}
      <div ref={haloRef} className="cursor-halo" aria-hidden />

      {/* Click flash. Painted via CSS var --cx/--cy on the click point. */}
      <div ref={flashRef} className="click-flash" aria-hidden />

      {/* First-load splash overlay. */}
      {splashStage !== "hidden" && (
        <div
          className={`splash splash--${splashStage}`}
          aria-hidden
          data-no-flash
        >
          <p className="splash-text t-accent text-bone">
            {splashStage === "connecting" ? (
              <>connecting<span className="blink">_</span></>
            ) : splashStage === "aligned" ? (
              <>aligned<span className="text-bleed">.</span></>
            ) : (
              <>aligned<span className="text-bleed">.</span></>
            )}
          </p>
        </div>
      )}

      {/* "alignment detected" — fades in for 2.4s after the secret keyboard
          command fires. Centered, monospace, electric-blue, with chromatic
          shadow + slight tilt. */}
      {alignment && (
        <div className="reveal-overlay" aria-live="polite" data-no-flash>
          <p className="reveal-overlay__text reveal">
            <span className="text-mute">&gt; </span>
            <span className="text-elec">alignment detected</span>
            <span className="blink text-bleed">_</span>
          </p>
        </div>
      )}

      {/* Rare "observed" — a single italic word, fixed in the upper-right
          quadrant, fades out after ~1.7s. Sometimes accompanies the rare
          screen-glitch. */}
      {observed && (
        <div className="observed-overlay" aria-hidden data-no-flash>
          <p className="observed-overlay__text reveal">
            observed<span className="text-bleed">.</span>
          </p>
        </div>
      )}

      {/* "low signal" caption — shown only between 00:00 and 04:00 local. */}
      {nightMode && (
        <span className="low-signal" aria-hidden>
          low signal
        </span>
      )}
    </>
  );
}

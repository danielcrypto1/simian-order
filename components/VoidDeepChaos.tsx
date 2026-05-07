"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { voidImageList, voidImageUrl, VOID_IMAGE_COUNT } from "@/lib/voidImages";
import { SOCIAL } from "@/lib/links";

/**
 * VoidDeepChaos — the chaos cinematic used by both /void/deep and
 * /void/deep/[code].
 *
 *   No code → preload → chaos (~9s) → freeze → returning → fading → /.
 *   Code   → preload → chaos (~9s) → freeze → reveal (held; user copies
 *            the code and clicks "claim — open discord", or "back").
 *
 * The chaos engine itself is identical in both modes. Only the post-
 * freeze stages differ — when a code is present, the freeze image
 * stays underneath the reveal panel so the cinematic "settles" into
 * the code drop instead of fading to home.
 */

type Stage = "preload" | "chaos" | "freeze" | "returning" | "fading" | "reveal";

const DESKTOP = {
  layers: 4,
  minSwapMs: 80,
  maxSwapMs: 160,
  textMinMs: 600,
  textMaxMs: 1500,
  totalMs: 9000,
};
const MOBILE = {
  layers: 2,
  minSwapMs: 140,
  maxSwapMs: 260,
  textMinMs: 800,
  textMaxMs: 1900,
  totalMs: 8000,
};

const FLASH_TEXTS = [
  "OBSERVED",
  "TOO LATE",
  "ENTRY RECORDED",
  "SIGNAL LOST",
  "YOU STAYED",
] as const;

const FILTERS = [
  "blur(2px)",
  "blur(4px)",
  "invert(1)",
  "invert(1) saturate(2)",
  "saturate(3)",
  "contrast(1.8)",
  "contrast(0.6)",
  "hue-rotate(45deg) saturate(1.4)",
  "hue-rotate(-30deg)",
  "brightness(1.5) contrast(1.4)",
  "brightness(0.5)",
  "blur(1px) saturate(2.5)",
  "none",
];

const TRANSFORMS = [
  "scale(1)",
  "scale(1.1)",
  "scale(1.25)",
  "scale(0.92)",
  "rotate(2deg) scale(1.05)",
  "rotate(-3deg) scale(1.1)",
  "skewX(2deg)",
  "skewY(-2deg) scale(1.05)",
  "rotate(180deg)",
  "scaleX(-1)",
  "scaleY(-1)",
];

const BLENDS = [
  "normal", "screen", "multiply", "lighten", "difference", "overlay",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export type VoidDeepChaosProps = {
  /**
   * If present, the cinematic ends on the code reveal screen instead
   * of returning to home. Pass the formatted display code, e.g.
   * "ORDER #7".
   */
  code?: string | null;
  /**
   * 1-based index of this claim (1..500). Used for the "// remaining"
   * caption on the reveal screen so the visitor sees how many keys
   * are left.
   */
  index?: number | null;
  /**
   * 500-cap reached: cinematic still plays but the reveal panel
   * displays ACCESS CLOSED instead of a code. No copy/claim controls.
   */
  full?: boolean;
};

export default function VoidDeepChaos({ code, index, full }: VoidDeepChaosProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<HTMLDivElement[]>([]);
  const [stage, setStage] = useState<Stage>("preload");
  const [flashText, setFlashText] = useState<string | null>(null);
  const [freezeUrl, setFreezeUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  // Guard so the chaos engine starts exactly once, even though the
  // useEffect that owns it can't include `stage` in its deps without
  // self-cancelling on the very first stage transition.
  const startedRef = useRef(false);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  const hasCode = !!code;
  const heldReveal = hasCode || !!full;

  // Mark as visited the moment the page mounts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("void_seen", "true");
      localStorage.setItem("void_last_seen", String(Date.now()));
    } catch { /* storage blocked — skip */ }
  }, []);

  // Esc bail-out — only when the cinematic ends by returning home.
  // If we'll hold on a reveal panel (code or full), don't let a stray
  // keypress throw away the visitor's only view of it.
  useEffect(() => {
    if (heldReveal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, heldReveal]);

  // Tear down audio on unmount.
  useEffect(() => () => {
    const a = audioRef.current;
    if (!a) return;
    try { a.ctx.close().catch(() => { /* ignore */ }); } catch { /* ignore */ }
    audioRef.current = null;
  }, []);

  // ── Preload images ──────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const list = voidImageList();
    const promises: Promise<void>[] = [];
    let decoded = 0;
    for (const url of list) {
      const img = new window.Image();
      img.src = url;
      const p = img
        .decode()
        .then(() => {
          decoded++;
          if (decoded === 2 && alive) setReady(true);
        })
        .catch(() => {
          decoded++;
          if (decoded === 2 && alive) setReady(true);
        });
      promises.push(p);
    }
    const fallback = window.setTimeout(() => { if (alive) setReady(true); }, 300);
    Promise.all(promises).finally(() => {/* all done, remaining cached */});
    return () => { alive = false; window.clearTimeout(fallback); };
  }, []);

  // ── Chaos engine ────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (startedRef.current) return;
    startedRef.current = true;
    setStage("chaos");

    const isMobile = window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
    const cfg = isMobile ? MOBILE : DESKTOP;

    try {
      const Ctor = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();

        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 380;
        filter.Q.value = 1.4;
        filter.connect(master);

        const o1 = ctx.createOscillator();
        o1.type = "triangle";
        o1.frequency.value = 60;
        o1.connect(filter);
        o1.start();

        const o2 = ctx.createOscillator();
        o2.type = "sawtooth";
        o2.frequency.value = 90;
        const o2g = ctx.createGain();
        o2g.gain.value = 0.35;
        o2.connect(o2g).connect(filter);
        o2.start();

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.18;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();

        const detune = ctx.createOscillator();
        detune.type = "sine";
        detune.frequency.value = 0.07;
        const detuneGain = ctx.createGain();
        detuneGain.gain.value = 18;
        detune.connect(detuneGain).connect(o2.detune);
        detune.start();

        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(
          isMobile ? 0.14 : 0.18,
          ctx.currentTime + cfg.totalMs / 1000
        );

        audioRef.current = { ctx, gain: master };

        const tryResume = () => {
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => { /* still suspended — wait for next gesture */ });
          }
        };
        tryResume();

        if (ctx.state === "suspended") {
          const events: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];
          const onGesture = () => {
            tryResume();
            events.forEach((ev) => window.removeEventListener(ev, onGesture, true));
          };
          events.forEach((ev) =>
            window.addEventListener(ev, onGesture, { capture: true, once: true, passive: true })
          );
        }
      }
    } catch { /* AudioContext unsupported / blocked — silent */ }

    let raf = 0;
    let nextSwapAt = performance.now();
    let nextTextAt = performance.now() + 1200;
    let alive = true;

    const tick = (t: number) => {
      if (!alive) return;
      if (t >= nextSwapAt) {
        const idx = Math.floor(Math.random() * cfg.layers);
        const el = layerRefs.current[idx];
        if (el) {
          const url = voidImageUrl(Math.floor(Math.random() * VOID_IMAGE_COUNT) + 1);
          const visible = Math.random() < 0.85;
          el.style.backgroundImage = visible ? `url("${url}")` : "none";
          el.style.opacity = visible ? String(randomBetween(0.55, 1)) : "0";
          el.style.filter = pick(FILTERS);
          el.style.transform = pick(TRANSFORMS);
          el.style.mixBlendMode = pick(BLENDS);
          const dx = Math.floor(randomBetween(-8, 8));
          const dy = Math.floor(randomBetween(-8, 8));
          el.style.backgroundPosition = `${50 + dx}% ${50 + dy}%`;
          el.style.backgroundSize = Math.random() < 0.7 ? "cover" : "contain";
        }
        nextSwapAt = t + randomBetween(cfg.minSwapMs, cfg.maxSwapMs);
      }
      if (t >= nextTextAt) {
        setFlashText(pick(FLASH_TEXTS));
        window.setTimeout(() => setFlashText(null), 240);
        nextTextAt = t + randomBetween(cfg.textMinMs, cfg.textMaxMs);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const freezeAt = window.setTimeout(() => {
      const url = voidImageUrl(Math.floor(Math.random() * VOID_IMAGE_COUNT) + 1);
      setFreezeUrl(url);
      setStage("freeze");
    }, cfg.totalMs);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(freezeAt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Freeze → (reveal | returning) ──────────────────────────────
  // With a code: cut the audio, then go straight to the reveal panel.
  // Without a code: preserve the existing returning → fading → /.
  useEffect(() => {
    if (stage !== "freeze") return;
    const a = audioRef.current;
    if (a) {
      try {
        const t = a.ctx.currentTime;
        a.gain.gain.cancelScheduledValues(t);
        a.gain.gain.linearRampToValueAtTime(0, t + 0.08);
      } catch { /* swallow */ }
    }
    const next: Stage = heldReveal ? "reveal" : "returning";
    const id = window.setTimeout(() => setStage(next), 1300);
    return () => window.clearTimeout(id);
  }, [stage, heldReveal]);

  useEffect(() => {
    if (stage !== "returning") return;
    const id = window.setTimeout(() => setStage("fading"), 1000);
    return () => window.clearTimeout(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== "fading") return;
    const id = window.setTimeout(() => router.push("/"), 700);
    return () => window.clearTimeout(id);
  }, [stage, router]);

  // ── Copy handler ────────────────────────────────────────────────
  const onCopy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for browsers without clipboard API access — select the
      // displayed code so the user can copy it manually.
      const el = document.getElementById("order-code-display");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [code]);

  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const layers = isMobile ? MOBILE.layers : DESKTOP.layers;

  const remaining =
    typeof index === "number" && index > 0
      ? Math.max(0, 500 - index)
      : null;

  return (
    <div
      ref={stageRef}
      className={`void-deep void-deep--${stage}`}
      style={{ overflow: "hidden" }}
    >
      {/* Image layers — pre-rendered, mutated by the chaos engine. */}
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { if (el) layerRefs.current[i] = el; }}
          className="void-deep__layer"
          aria-hidden
        />
      ))}

      <div className="void-deep__glitch" aria-hidden />
      <div className="void-deep__scan" aria-hidden />
      <div className="void-deep__grain" aria-hidden />

      {flashText && stage === "chaos" && (
        <p className="void-deep__flash" aria-hidden>{flashText}</p>
      )}

      {stage === "preload" && (
        <p className="void-deep__hint">
          <span className="text-mute">// </span>
          <span className="text-bleed">you stayed</span>
          <span className="blink text-bleed">_</span>
        </p>
      )}

      {/* Freeze — single image fixed, overlay text. */}
      {stage === "freeze" && freezeUrl && (
        <>
          <div
            className="void-deep__freeze"
            aria-hidden
            style={{ backgroundImage: `url("${freezeUrl}")` }}
          />
          <p className="void-deep__overlay-text">
            you stayed too long<span className="blink text-bleed">.</span>
          </p>
        </>
      )}

      {/* Returning sequence (no-code mode only). */}
      {(stage === "returning" || stage === "fading") && (
        <>
          {freezeUrl && (
            <div
              className={`void-deep__freeze ${stage === "fading" ? "is-fading" : ""}`}
              aria-hidden
              style={{ backgroundImage: `url("${freezeUrl}")` }}
            />
          )}
          <p className="void-deep__overlay-text">
            <span className="text-mute">&gt; </span>
            returning
            <span className="blink text-bleed">_</span>
          </p>
        </>
      )}

      {stage === "fading" && <div className="void-deep__blackout" aria-hidden />}

      {/* Reveal — held terminal screen. With a code: shows the
          ORDER #N + copy + Discord claim. In `full` mode (cap reached
          with no code): shows ACCESS CLOSED with a quiet back link. */}
      {stage === "reveal" && heldReveal && freezeUrl && (
        <div
          className="void-deep__freeze"
          aria-hidden
          style={{ backgroundImage: `url("${freezeUrl}")`, opacity: 0.18 }}
        />
      )}

      {stage === "reveal" && full && !hasCode && (
        <div className="void-deep__reveal" role="dialog" aria-label="access closed">
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed mb-3">
            ── status / 423 / locked ──
          </p>
          <h1 className="t-display italic text-[40px] sm:text-7xl leading-none mb-4 text-bleed tilt-r">
            access closed<span className="blink">.</span>
          </h1>
          <p className="font-serif italic text-base text-ape-200 mb-8">
            all 500 keys have been claimed. the door is shut.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
            <Link
              href="/"
              className="entry-link text-base sm:text-lg"
              style={{ transform: "rotate(-0.6deg)" }}
            >
              [ back ]
            </Link>
          </div>
          <p className="mt-12 font-mono text-xxs uppercase tracking-widest2 text-mute">
            // remaining: 0 / 500
          </p>
        </div>
      )}

      {stage === "reveal" && hasCode && (
          <div className="void-deep__reveal" role="dialog" aria-label="order code">
            <p className="font-mono text-xxxs uppercase tracking-widest2 text-elec mb-3">
              ── status / 200 / granted ──
            </p>
            <h1 className="t-display italic text-[40px] sm:text-7xl leading-none mb-4 text-bone tilt-l">
              access granted<span className="blink text-bleed">.</span>
            </h1>
            <p className="font-serif italic text-base text-ape-200 mb-8">
              the door is open. once.
            </p>

            <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-2">
              ── your code ──
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8">
              <div
                id="order-code-display"
                className="font-mono text-3xl sm:text-5xl tracking-[0.18em] text-bleed select-all py-2"
                aria-label="your order code"
              >
                {code}
              </div>
              <button
                type="button"
                onClick={onCopy}
                className="text-link"
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                aria-live="polite"
              >
                [ {copied ? "copied ✓" : "copy"} ]
              </button>
            </div>

            <div className="divider-glitch max-w-[280px] my-6" aria-hidden />

            <ol className="font-mono text-xs sm:text-sm text-ape-100 space-y-2 leading-relaxed mb-6">
              <li>
                <span className="text-mute">01.</span>{" "}
                copy your code.
              </li>
              <li>
                <span className="text-mute">02.</span>{" "}
                click <span className="text-bone">[ claim — open discord ]</span> below.
              </li>
              <li>
                <span className="text-mute">03.</span>{" "}
                open a ticket in discord and paste the code to receive the{" "}
                <span className="text-elec">HIGH ORDER</span> role.
              </li>
            </ol>

            <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
              <a
                href={SOCIAL.DISCORD}
                target="_blank"
                rel="noopener noreferrer"
                className="entry-link text-base sm:text-lg"
                style={{ transform: "rotate(-0.6deg)" }}
              >
                [ claim — open discord ↗ ]
              </a>
              <Link
                href="/"
                className="entry-link text-base sm:text-lg"
                style={{ transform: "rotate(0.8deg) translateY(-2px)" }}
              >
                [ back ]
              </Link>
            </div>

            {remaining !== null && (
              <p className="mt-12 font-mono text-xxs uppercase tracking-widest2 text-mute">
                // remaining: {remaining} / 500
              </p>
            )}
          </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { voidImageList, voidImageUrl, VOID_IMAGE_COUNT } from "@/lib/voidImages";

/**
 * /void/deep — chaos experience.
 *
 * No nav, no buttons, no chrome. The page hijacks the screen for ~12s:
 *
 *   t=0       preload begins, black screen with single hint line
 *   t≈400ms   first frame paints — stage="chaos"
 *   t≈10500   freeze on a single image, stage="freeze",
 *             overlay "you stayed too long"
 *   t≈11800   stage="returning", "returning" line shown
 *   t≈12300   fade-to-black begins
 *   t≈13000   router.push("/")
 *
 * On unmount: localStorage["void_seen"]="true",
 *             localStorage["void_last_seen"]=Date.now().toString()
 * — so the /void redirect logic skips re-entry for 10 min, and the
 * rest of the site can light up post-visit residue (see <VoidResidue>
 * for the global hooks).
 *
 * Performance:
 *   - All animation runs through one requestAnimationFrame loop.
 *   - Image swaps mutate `style.backgroundImage` on a fixed pool of
 *     layer divs — no React re-render per swap, no DOM thrash.
 *   - Mobile detection caps layers (1-3 vs 2-5) and slows the swap rate.
 *   - Images are preloaded sequentially in the background; rapid swaps
 *     start as soon as the first 4 are decoded.
 *
 * No-UI rule honoured: no buttons, no nav links. Pressing Esc does
 * still let the user return (we listen and short-circuit to /).
 */

type Stage = "preload" | "chaos" | "freeze" | "returning" | "fading";

// Tunables. Mobile values are slower / fewer layers per the brief.
const DESKTOP = {
  layers: 4,            // 4 image layers stacked (some shown, some hidden)
  minSwapMs: 80,        // fastest possible swap interval
  maxSwapMs: 160,       // slowest swap interval (still rapid)
  textMinMs: 600,       // gap between text flashes
  textMaxMs: 1500,
  totalMs: 10500,       // chaos duration
};
const MOBILE = {
  layers: 2,
  minSwapMs: 140,
  maxSwapMs: 260,
  textMinMs: 800,
  textMaxMs: 1900,
  totalMs: 9500,
};

const FLASH_TEXTS = [
  "OBSERVED",
  "TOO LATE",
  "ENTRY RECORDED",
  "SIGNAL LOST",
  "YOU STAYED",
] as const;

// Pool of CSS filters the chaos engine rolls through. Each layer picks
// one fresh filter every swap cycle. Compositor-only.
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

export default function VoidDeepPage() {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<HTMLDivElement[]>([]);
  const [stage, setStage] = useState<Stage>("preload");
  const [flashText, setFlashText] = useState<string | null>(null);
  const [freezeUrl, setFreezeUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Guard so the chaos engine starts exactly once, even though the
  // useEffect that owns it can't include `stage` in its deps without
  // self-cancelling on the very first stage transition.
  const startedRef = useRef(false);

  // Mark as visited the moment the page mounts, even if the user bails
  // — they saw enough.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("void_seen", "true");
      localStorage.setItem("void_last_seen", String(Date.now()));
    } catch { /* storage blocked — skip */ }
  }, []);

  // Esc bail-out — skips the cinematic and routes home immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // ── Preload images ──────────────────────────────────────────────
  // Sequential decode — fires `setReady(true)` as soon as the first
  // four are decoded so we can start the chaos without waiting for
  // every file to land. Remaining images keep loading in the
  // background; the random picker has a fallback for not-yet-loaded
  // entries (the browser cache will serve them when they're ready).
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
          if (decoded === 4 && alive) setReady(true);
        })
        .catch(() => {
          decoded++;
          if (decoded === 4 && alive) setReady(true);
        });
      promises.push(p);
    }
    // Safety: even if decoding stalls, kick off after 1500ms.
    const fallback = window.setTimeout(() => { if (alive) setReady(true); }, 1500);
    Promise.all(promises).finally(() => {/* all done, remaining cached */});
    return () => { alive = false; window.clearTimeout(fallback); };
  }, []);

  // ── Chaos engine ────────────────────────────────────────────────
  // Once `ready`, transition to "chaos" and run a single rAF loop that:
  //   - randomly picks layers to swap on each "tick" (every 80-260ms)
  //   - assigns each swap a fresh image / filter / transform / blend
  //   - fires a text flash on its own slower interval
  // All side-effects mutate refs / inline styles, never React state
  // (except the rare text flash + stage transitions). At >60Hz scroll
  // it's ~3% main-thread per second on a mid-tier mobile.
  //
  // BUG-FIX NOTE: this effect must NOT depend on `stage`. If it did,
  // calling setStage("chaos") inside the effect would re-run the
  // effect, fire the cleanup (cancelling the rAF + freeze timeout),
  // and then return early through the guard. The engine would die
  // 1 frame after starting. Guard via the startedRef instead so the
  // engine boots exactly once when `ready` flips to true.
  useEffect(() => {
    if (!ready) return;
    if (startedRef.current) return;
    startedRef.current = true;
    setStage("chaos");

    const isMobile = window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
    const cfg = isMobile ? MOBILE : DESKTOP;

    let raf = 0;
    let nextSwapAt = performance.now();
    let nextTextAt = performance.now() + 1200;
    let alive = true;

    const tick = (t: number) => {
      if (!alive) return;
      if (t >= nextSwapAt) {
        // Pick a random layer to swap. Each layer gets fresh visual
        // params on its swap turn.
        const idx = Math.floor(Math.random() * cfg.layers);
        const el = layerRefs.current[idx];
        if (el) {
          const url = voidImageUrl(Math.floor(Math.random() * VOID_IMAGE_COUNT) + 1);
          const visible = Math.random() < 0.85; // some swaps blank a layer
          el.style.backgroundImage = visible ? `url("${url}")` : "none";
          el.style.opacity = visible ? String(randomBetween(0.55, 1)) : "0";
          el.style.filter = pick(FILTERS);
          el.style.transform = pick(TRANSFORMS);
          el.style.mixBlendMode = pick(BLENDS);
          // Random offset within ±8% of viewport so layers don't all
          // line up perfectly center.
          const dx = Math.floor(randomBetween(-8, 8));
          const dy = Math.floor(randomBetween(-8, 8));
          el.style.backgroundPosition = `${50 + dx}% ${50 + dy}%`;
          // Vary background-size between cover (cropped) and contain
          // (letterboxed) — both contribute to the disorientation.
          el.style.backgroundSize = Math.random() < 0.7 ? "cover" : "contain";
        }
        nextSwapAt = t + randomBetween(cfg.minSwapMs, cfg.maxSwapMs);
      }
      if (t >= nextTextAt) {
        setFlashText(pick(FLASH_TEXTS));
        // Auto-clear via timer — text flash <300ms per spec.
        window.setTimeout(() => setFlashText(null), 240);
        nextTextAt = t + randomBetween(cfg.textMinMs, cfg.textMaxMs);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Schedule the freeze frame ~10s in.
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
    // Intentionally only `ready` — see BUG-FIX NOTE above. The
    // startedRef guard ensures we start exactly once, on the
    // ready→true transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Freeze → returning → fading → home ──────────────────────────
  // Each stage transition lives in its own useEffect so the cleanup
  // of the previous one doesn't wipe the next stage's timer (same
  // class of bug fixed on the chaos engine above). Linear progression:
  //   freeze   (1.3s) → returning
  //   returning (1.0s) → fading
  //   fading   (0.7s) → router.push("/")
  useEffect(() => {
    if (stage !== "freeze") return;
    const id = window.setTimeout(() => setStage("returning"), 1300);
    return () => window.clearTimeout(id);
  }, [stage]);

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

  // Determine layer count from one place — used both for the rAF loop
  // (cfg.layers) and the JSX render. Default to desktop until ready.
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const layers = isMobile ? MOBILE.layers : DESKTOP.layers;

  return (
    <div
      ref={stageRef}
      className={`void-deep void-deep--${stage}`}
      // Block scroll + interaction while the engine runs.
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

      {/* Constant glitch overlay — same Glitch.png used elsewhere on
          the site, here at higher opacity. */}
      <div className="void-deep__glitch" aria-hidden />
      <div className="void-deep__scan" aria-hidden />
      <div className="void-deep__grain" aria-hidden />

      {/* Text flash — random brand-vocabulary words during chaos. */}
      {flashText && stage === "chaos" && (
        <p className="void-deep__flash" aria-hidden>{flashText}</p>
      )}

      {/* Pre-chaos: subtle hint while images decode. */}
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

      {/* Returning sequence. */}
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

      {/* Hard fade-to-black overlay during the final stage. */}
      {stage === "fading" && <div className="void-deep__blackout" aria-hidden />}
    </div>
  );
}

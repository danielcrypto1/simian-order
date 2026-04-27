"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * /void — hidden page. No nav link points here.
 *
 * Reachable via:
 *   - Direct URL (`/void`)
 *   - Logo 5-click easter egg (reveals a [ deeper ] link)
 *   - Landing's [ ??? ] door, when opened, leads to /dashboard/mint —
 *     this page is its quieter sibling.
 *
 * Visual: pure black, single void.png at very low opacity behind a
 * single italic line of serif text, plus a tiny return link. No
 * topbar, no footer, no chrome. The InteractionLayer (cursor halo,
 * click flash, rare glitch) is still present from the root layout —
 * everything else is stripped.
 */
export default function VoidPage() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Subtle one-time RGB-split twitch when the page mounts.
  useEffect(() => {
    const t = titleRef.current;
    if (!t) return;
    const id = window.setTimeout(() => {
      t.classList.add("rgbsplit");
      window.setTimeout(() => t.classList.remove("rgbsplit"), 320);
    }, 380);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-bone select-none">
      {/* Layer 1 — single void image, large, blurred, low opacity */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image
          src="/media/void.png"
          alt=""
          aria-hidden
          width={900}
          height={900}
          priority
          quality={70}
          className="object-contain ghost-c"
          style={{
            opacity: 0.18,
            filter: "blur(6px) drop-shadow(0 0 40px rgba(0,64,255,0.25))",
            maxWidth: "75vw",
            maxHeight: "85vh",
            width: "auto",
            height: "auto",
          }}
        />
      </div>

      {/* Layer 2 — far ghost, even fainter, slow drift */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image
          src="/media/void.png"
          alt=""
          aria-hidden
          width={900}
          height={900}
          quality={60}
          className="object-contain ghost-l"
          style={{
            opacity: 0.07,
            filter: "blur(14px)",
            maxWidth: "92vw",
            maxHeight: "98vh",
            width: "auto",
            height: "auto",
          }}
        />
      </div>

      {/* Layer 3 — text, slightly off-center, tilted */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="max-w-[640px] -mt-12 tilt-l">
          <p className="font-mono text-xxxs uppercase tracking-widest2 text-mute mb-3">
            ── /void ── access depth: 03 ──
          </p>
          <h1
            ref={titleRef}
            className="t-display italic text-5xl sm:text-6xl md:text-7xl leading-none mb-4 t-split"
          >
            you were not meant
            <br />
            to find this<span className="blink text-bleed">.</span>
          </h1>
          <p className="font-serif italic text-base sm:text-lg text-ape-200 t-blur">
            the order keeps doors that open inward.
          </p>

          <div className="section-glitch max-w-[260px] mt-8 mb-6" aria-hidden />

          <div className="flex items-baseline gap-6">
            <Link href="/" className="text-link" prefetch={false}>
              [ leave ]
            </Link>
            <span className="font-serif italic text-xs text-mute">
              or stay. it doesn&rsquo;t matter.
            </span>
          </div>
        </div>
      </div>

      {/* Atmospheric chrome — minimal */}
      <div className="absolute top-2 left-3 font-mono text-xxxs uppercase tracking-widest2 text-bleed pointer-events-none">
        // /void &mdash; no record kept
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-xxxs uppercase tracking-widest2 text-mute pointer-events-none">
        you are alone here
      </div>
    </main>
  );
}

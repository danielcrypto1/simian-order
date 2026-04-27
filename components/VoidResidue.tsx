"use client";

import { useEffect, useState } from "react";
import { voidImageUrl, VOID_IMAGE_COUNT } from "@/lib/voidImages";

/**
 * Post-/void/deep residue.
 *
 * Mounted once globally (alongside InteractionLayer). Reads
 * localStorage["void_seen"] on mount; if true, lights up subtle
 * after-effects across every page:
 *
 *   1. Adds `body.void-seen` so other components can react via CSS.
 *      (Used by ConnectWalletButton to override the alignment label,
 *      and by /dashboard/referral to surface "clearance: partial".)
 *   2. Renders a faint corner caption "you've seen it" that pulses
 *      in once per session.
 *   3. Random rare event: a void image flashes for ~90ms.
 *      Frequency: every 60-180s, ~25% chance per cycle.
 *
 * Component renders nothing if the user has never visited /void/deep.
 * On first /void/deep entry the chaos page sets the flag; the residue
 * picks it up on the very next mount.
 */
export default function VoidResidue() {
  const [seen, setSeen] = useState(false);
  const [hint, setHint] = useState(false);
  const [flashUrl, setFlashUrl] = useState<string | null>(null);

  // Detect the seen flag on mount + listen for changes via storage event
  // (in case another tab visits /void/deep mid-session).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const v = localStorage.getItem("void_seen") === "true";
      setSeen(v);
      document.body.classList.toggle("void-seen", v);
    };
    apply();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "void_seen") apply();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.body.classList.remove("void-seen");
    };
  }, []);

  // Once-per-session hint reveal — fires ~12s after the page mounts
  // (so the user has settled into whatever they came back to). Only
  // triggers once across the whole tab via sessionStorage.
  useEffect(() => {
    if (!seen) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("void_hint_shown") === "1") return;
    const t = window.setTimeout(() => {
      setHint(true);
      sessionStorage.setItem("void_hint_shown", "1");
      window.setTimeout(() => setHint(false), 4000);
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [seen]);

  // Rare void-image flashes — every 60-180s, 25% chance each cycle.
  // Pre-decodes the image before showing so the flash is instant.
  useEffect(() => {
    if (!seen) return;
    if (typeof window === "undefined") return;
    let id = 0;
    let alive = true;

    const fire = () => {
      if (!alive) return;
      if (Math.random() >= 0.25) return; // skip this cycle
      const url = voidImageUrl(Math.floor(Math.random() * VOID_IMAGE_COUNT) + 1);
      const img = new window.Image();
      img.src = url;
      img.decode().then(() => {
        if (!alive) return;
        setFlashUrl(url);
        window.setTimeout(() => setFlashUrl(null), 90);
      }).catch(() => {/* skip on decode error */});
    };
    const schedule = () => {
      const ms = 60_000 + Math.random() * 120_000; // 60s..180s
      id = window.setTimeout(() => { fire(); schedule(); }, ms);
    };
    schedule();
    return () => { alive = false; clearTimeout(id); };
  }, [seen]);

  if (!seen) return null;

  return (
    <>
      {/* "you've seen it" — fades in once per tab session. */}
      {hint && (
        <span className="void-residue-hint reveal" aria-hidden>
          // you&rsquo;ve seen it
        </span>
      )}

      {/* Rare image flash (~90ms). Painted as a single fixed div with
          background-image so we don't drop a heavy <img> into the DOM
          for every flash. */}
      {flashUrl && (
        <div
          className="void-residue-flash"
          aria-hidden
          style={{ backgroundImage: `url("${flashUrl}")` }}
        />
      )}
    </>
  );
}

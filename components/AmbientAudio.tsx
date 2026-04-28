"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Site-wide ambient audio.
 *
 * Behaviour:
 *   - Loads /audio/simian.mp3, looped, low volume.
 *   - Does NOT play until the user's first gesture in the tab
 *     (pointerdown / keydown / touchstart anywhere). Modern
 *     browsers reject autoplay-with-sound until that gesture
 *     happens; the listener satisfies it organically without
 *     forcing the user to click the toggle.
 *   - Pauses automatically on /void/deep so the chaos page's
 *     own Web Audio drone has the room to itself, then resumes
 *     when the user comes back to a normal route.
 *   - Toggle stored in localStorage["sound_enabled"]. Default is
 *     "true" (i.e. play after first gesture). User flips it to
 *     "false" via the toggle and the choice persists across
 *     visits.
 *   - Mobile-safe: same first-gesture path. iOS Safari requires
 *     audio to be created on or after a user gesture; we lazy-
 *     create the <audio> element on the first gesture handler.
 *   - Fail-silent: if the MP3 is missing (404), the play()
 *     promise rejects, we log nothing, and the toggle just
 *     becomes a no-op. Drop a real file in /public/audio/
 *     and the system lights up on the next refresh.
 *
 * Toggle visual: a tiny mono caps "♪ on" / "♪ off" pill in the
 * top-right corner. 9px / opacity 0.45 — barely there until the
 * user hovers or taps.
 */

const AUDIO_SRC = "/audio/simian.mp3";
const STORAGE_KEY = "sound_enabled";
const VOLUME = 0.20;
// Routes where ambient should pause — chaos page has its own audio.
const MUTE_ROUTES = ["/void/deep"];

type Status = "idle" | "playing" | "paused" | "blocked" | "error";

export default function AmbientAudio() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);   // user intent
  const [unlocked, setUnlocked] = useState<boolean>(false); // first-gesture happened
  const [status, setStatus] = useState<Status>("idle");

  // Hydrate enabled from localStorage on mount. Default true.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "false") setEnabled(false);
      else setEnabled(true); // null or "true"
    } catch { /* storage blocked — keep default */ }
  }, []);

  // Lazy-create the <audio> element on first gesture so iOS Safari's
  // user-gesture requirement is satisfied. Once the user has clicked
  // anywhere in the tab, audio creation + play() is allowed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (unlocked) return;

    const onGesture = () => {
      setUnlocked(true);
      // Create the element exactly once.
      if (!audioRef.current) {
        try {
          const a = new Audio(AUDIO_SRC);
          a.loop = true;
          a.volume = VOLUME;
          a.preload = "auto";
          // Hint to the browser this is background — no media-session
          // controls, doesn't claim the lockscreen on mobile.
          a.setAttribute("playsinline", "true");
          audioRef.current = a;
        } catch { /* construction failed — fall through to no-op */ }
      }
    };

    const opts: AddEventListenerOptions = { once: true, capture: true, passive: true };
    document.addEventListener("pointerdown", onGesture, opts);
    document.addEventListener("keydown", onGesture, opts);
    document.addEventListener("touchstart", onGesture, opts);
    return () => {
      // once:true means handlers self-remove after firing, but we
      // also clean up on unmount before they fire.
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("touchstart", onGesture, true);
    };
  }, [unlocked]);

  // Reconcile play/pause whenever intent / unlock / route changes.
  // Single source of truth — every state shift recomputes shouldPlay
  // from the inputs.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const muted = MUTE_ROUTES.includes(pathname || "");
    const shouldPlay = enabled && unlocked && !muted;
    if (shouldPlay && audio.paused) {
      audio.play().then(
        () => setStatus("playing"),
        () => {
          // Most likely a 404 on the MP3 (no file dropped yet) or
          // an autoplay-policy refusal that survived the gesture.
          setStatus("blocked");
        }
      );
    } else if (!shouldPlay && !audio.paused) {
      audio.pause();
      setStatus("paused");
    }
  }, [enabled, unlocked, pathname]);

  // Stop playback on unmount so we don't leak a hanging <audio>.
  useEffect(() => () => {
    const a = audioRef.current;
    if (a) {
      try { a.pause(); a.src = ""; } catch { /* noop */ }
    }
    audioRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
    // If the user clicked the toggle BEFORE any other gesture, count
    // it as the unlock event too — otherwise we'd require another tap
    // somewhere else to actually start audio.
    if (!unlocked) {
      setUnlocked(true);
      if (!audioRef.current) {
        try {
          const a = new Audio(AUDIO_SRC);
          a.loop = true;
          a.volume = VOLUME;
          a.preload = "auto";
          a.setAttribute("playsinline", "true");
          audioRef.current = a;
        } catch { /* skip */ }
      }
    }
  }, [unlocked]);

  // Visual label — keep it terse. "♪" carries the meaning, the word
  // gives the state.
  const label = enabled
    ? status === "playing" ? "♪ on"
    : status === "blocked" ? "♪ —"
    : "♪ on"
    : "♪ off";

  return (
    <button
      type="button"
      onClick={toggle}
      className="ambient-audio-toggle"
      aria-label={enabled ? "mute audio" : "play audio"}
      aria-pressed={enabled}
      data-no-flash
      // Title surfaces the actual playback state for users who care.
      title={
        status === "blocked"
          ? "no audio file at /audio/simian.mp3"
          : status === "playing"
          ? "ambient audio playing — click to mute"
          : "ambient audio muted — click to enable"
      }
    >
      {label}
    </button>
  );
}

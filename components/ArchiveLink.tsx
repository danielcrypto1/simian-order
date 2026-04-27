"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * A subtle dead "[ archive ]" text-link. Clicking it does NOT navigate.
 *
 * Sequence on click:
 *   1. 0     ms — full-screen black overlay appears with "404"
 *   2. 300   ms — text swaps to "nothing is lost"
 *   3. 800   ms — overlay fades out (500ms ease) over the underlying page
 *   4. 1300  ms — overlay unmounts; user is back where they started
 *
 * The overlay uses `pointer-events: auto` while visible to swallow extra
 * clicks during the sequence — re-clicking [ archive ] mid-fade is a
 * no-op so the timing never desyncs.
 */
type Stage = "idle" | "n404" | "text" | "fading";

export default function ArchiveLink({ className = "" }: { className?: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // Tear down outstanding timers on unmount.
  useEffect(() => () => clearTimers(), []);

  const onClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (stage !== "idle") return;
    track("archive_404");
    setStage("n404");
    timers.current.push(window.setTimeout(() => setStage("text"),   300));
    timers.current.push(window.setTimeout(() => setStage("fading"), 800));
    timers.current.push(window.setTimeout(() => setStage("idle"),  1300));
  }, [stage]);

  const overlayLabel =
    stage === "n404"
      ? "404"
      : stage === "text" || stage === "fading"
      ? "nothing is lost."
      : null;

  return (
    <>
      <a
        href="#archive"
        onClick={onClick}
        className={`text-link ${className}`}
        // Skip the global click-flash so the overlay's reveal feels
        // self-contained.
        data-no-flash
      >
        [ archive ]
      </a>

      {stage !== "idle" && (
        <div
          className={`archive-overlay${stage === "fading" ? " archive-overlay--fading" : ""}`}
          aria-hidden
          data-no-flash
        >
          <p className="archive-overlay__text">{overlayLabel}</p>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import {
  TWEETS,
  copyCardImageWithBlob,
  downloadShareCardBlob,
  fetchShareCardBlob,
  openTweet,
  shareCardUrl,
} from "@/lib/twitterShare";
import { track } from "@/lib/analytics";

type Props = {
  open: boolean;
  onClose: () => void;
  round: number;
  /** Wallet of the approved applicant. Sent to /api/share-card and
   *  masked there before being painted on the card. */
  wallet: string;
};

type CopyState = "idle" | "copying" | "copied" | "fallback";
type DownloadState = "idle" | "downloading" | "ok" | "err";

/**
 * Detects platforms where the clipboard image API is unreliable enough
 * that we'd rather skip it and go straight to a download. iOS/Safari is
 * the main offender: `ClipboardItem` exists but image writes commonly
 * fail under user-gesture rules in real-world flows. Detection is best-
 * effort — if we miss a case the in-modal try/catch still covers it.
 */
function isImageClipboardUnreliable(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  return isIOS;
}

/**
 * "Share Approval Card" overlay.
 *
 * Two-step share flow (text + image are NOT copied together — Chromium
 * silently drops one branch when both are written in the same
 * clipboard.write call, so we keep them separate):
 *
 *   1. Copy Image  → puts ONLY the PNG on the clipboard
 *   2. Share on X  → opens the intent URL with the tweet text pre-filled
 *
 * The user pastes the image into the X composer after the text loads.
 *
 * Visual: matches the site — black panel, courier mono header, hard 1px
 * border, no rounded corners. Backdrop is dimmed-black with a faint
 * blur so the card preview pops without burying the user under chrome.
 *
 * Accessibility: rendered as role="dialog" aria-modal, ESC + backdrop
 * click close it, focus is sent to the panel on open.
 */
export default function ShareApprovalModal({ open, onClose, round, wallet }: Props) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [dlState, setDlState] = useState<DownloadState>("idle");
  // Pre-fetched card PNG. Loaded on open so `clipboard.write()` can
  // run synchronously from the click handler without losing user
  // activation across a network fetch — Chromium silently drops the
  // image branch if the ClipboardItem promise takes too long.
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  // Whether the <img> preview has finished loading. Drives the
  // "rendering card" skeleton overlay below — the PNG is generated
  // on-demand server-side so the first paint can take 1-3s.
  const [previewLoaded, setPreviewLoaded] = useState(false);
  // The tweet text is picked at modal-open time so the user sees a
  // stable string and isn't surprised by the random variant changing
  // on every action. Memoised on (open, round).
  const tweetText = useMemo(() => (open ? TWEETS.approval(round) : ""), [open, round]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Reset state whenever the modal re-opens so a stale "copied" tick
  // from a previous open doesn't carry over.
  useEffect(() => {
    if (open) {
      setCopyState("idle");
      setDlState("idle");
      setCardBlob(null);
      setPreviewLoaded(false);
    }
  }, [open]);

  // Pre-fetch the card PNG as soon as the modal opens. If the round
  // or wallet changes mid-open we abort the previous fetch so the
  // wrong blob doesn't land in state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await fetchShareCardBlob(round, wallet);
        if (!cancelled) setCardBlob(blob);
      } catch {
        // Don't surface yet — onCopy/onDownload will retry the fetch
        // and show the fallback themselves if it fails again.
      }
    })();
    return () => { cancelled = true; };
  }, [open, round, wallet]);

  // ESC to close. Bound only while open so we don't compete with
  // unrelated handlers when the modal isn't on screen.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock background scroll while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Send focus into the panel for keyboard users when it opens.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const onCopyImage = useCallback(async () => {
    setCopyState("copying");
    track("share_card_copy_attempt");

    // iOS Safari: image clipboard is unreliable. Auto-route to a
    // download so the user has the file in their camera roll / Files,
    // then they can attach it in the X composer themselves.
    if (isImageClipboardUnreliable()) {
      try {
        const blob = cardBlob ?? (await fetchShareCardBlob(round, wallet));
        downloadShareCardBlob(blob, round);
        setCopyState("fallback");
        track("share_card_copy_fallback_ios");
      } catch {
        setCopyState("fallback");
      }
      return;
    }

    // Desktop: write image-only to clipboard. Pre-fetched blob keeps
    // clipboard.write inside the user-activation window. Verify the
    // image actually landed (Chromium silent-fail check) — if not,
    // surface the download fallback instead of falsely claiming success.
    let blob = cardBlob;
    if (!blob) {
      try { blob = await fetchShareCardBlob(round, wallet); }
      catch { setCopyState("fallback"); return; }
    }

    const ok = await copyCardImageWithBlob(blob);
    if (ok) {
      setCopyState("copied");
      track("share_card_copied");
    } else {
      setCopyState("fallback");
      track("share_card_copy_text_only", { reason: "image-write-failed" });
    }
  }, [round, wallet, cardBlob]);

  const onShare = useCallback(() => {
    openTweet(tweetText);
    track("share_card_open_x");
  }, [tweetText]);

  const onDownload = useCallback(async () => {
    setDlState("downloading");
    try {
      const blob = cardBlob ?? (await fetchShareCardBlob(round, wallet));
      downloadShareCardBlob(blob, round);
      setDlState("ok");
      track("share_card_downloaded");
    } catch {
      setDlState("err");
    }
  }, [round, wallet, cardBlob]);

  if (!open) return null;

  const showDownloadFallback = copyState === "fallback";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Share Approval Card"
      // Build marker so we can verify in production which version of
      // the modal is live (minified bundle hides function names; this
      // attribute survives). Bump when shipping fixes that need
      // verification from the outside.
      data-share-modal-build="2026-05-04-image-only+loading"
      onMouseDown={(e) => {
        // Only close on backdrop click (target === currentTarget),
        // not when the click started inside the panel and the user
        // happened to release outside it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop — solid-black + subtle blur. Separate layer so the
          panel sits crisply above the noise/grain of the page. */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0, 0, 0, 0.82)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Panel — uses the same hard-edge / courier-header look as the
          rest of the site, hand-rolled here so we can include a close
          button in the header. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="panel relative w-full max-w-[480px] outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <span>
            <span className="text-elec">&gt;</span> share recognition
          </span>
          <button
            onClick={onClose}
            aria-label="close"
            className="font-mono text-xxs uppercase tracking-widest2 text-mute hover:text-bone px-1"
          >
            [ X ]
          </button>
        </div>

        <div className="panel-body space-y-3">
          {/* Card preview area. The PNG is generated on-demand server-
              side and can take 1-3s on a cold edge instance, so we
              show a courier-mono "rendering" skeleton until the <img>
              fires onLoad. Aspect-ratio square keeps the panel from
              jumping when the image arrives. */}
          <div className="relative border border-border bg-black aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shareCardUrl(round, wallet)}
              alt="approval share card preview"
              className="block w-full h-auto"
              width={1200}
              height={1200}
              onLoad={() => setPreviewLoaded(true)}
              onError={() => setPreviewLoaded(true)}
              style={{ opacity: previewLoaded ? 1 : 0, transition: "opacity 200ms" }}
            />

            {!previewLoaded && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none"
                aria-hidden
              >
                {/* Mono caps "system" line — same vibe as the round
                    badge / status strips elsewhere on the site. */}
                <div className="font-mono text-xxs uppercase tracking-widest2 text-mute">
                  // rendering card<span className="loading-dots" />
                </div>
                {/* Italic serif tagline below — site signature. */}
                <div className="font-serif italic text-xs text-mute">
                  the order is composing your verdict
                </div>
                {/* Subtle electric-blue scanline pulse, drawn as a
                    thin horizontal bar that animates via tailwind's
                    animate-pulse. Reads as system telemetry. */}
                <div className="mt-2 h-[2px] w-24 bg-elec/60 animate-pulse" />
              </div>
            )}
          </div>

          {/* Helper text — explains the two-step flow. */}
          <p className="font-serif italic text-xxs text-mute leading-relaxed">
            copy the image, then share on x and paste it in.
          </p>

          {/* Action row — primary copies the image to clipboard;
              secondary opens the X composer with the tweet text. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={copyState === "copying" || !cardBlob}
              onClick={onCopyImage}
            >
              {copyState === "copying"
                ? "Copying…"
                : !cardBlob
                ? "Preparing…"
                : "Copy Image"}
            </Button>
            <Button variant="ghost" onClick={onShare}>
              Share on X
            </Button>
          </div>

          {/* Status line under the actions. Uses electric blue for
              success and bleed-red for fail, matching the rest of the
              site's status conventions. */}
          {copyState === "copied" && (
            <p className="font-mono text-xxxs uppercase tracking-widest2 text-elec">
              image copied. click share on x and paste it in.
            </p>
          )}
          {copyState === "fallback" && (
            <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed">
              clipboard blocked — save the card below and attach manually.
            </p>
          )}

          {/* Fallback: only surfaces when the image clipboard write
              didn't land. Pure-additive — never replaces the primary
              actions. */}
          {showDownloadFallback && (
            <div className="pt-1 border-t border-border">
              <div className="text-xxs uppercase tracking-wide text-mute mb-1">
                fallback
              </div>
              <Button
                variant="ghost"
                disabled={dlState === "downloading"}
                onClick={onDownload}
              >
                {dlState === "downloading" ? "Saving…" : "Download Card"}
              </Button>
              {dlState === "ok" && (
                <span className="font-mono text-xxxs uppercase tracking-widest2 text-elec ml-2">
                  saved.
                </span>
              )}
              {dlState === "err" && (
                <span className="font-mono text-xxxs uppercase tracking-widest2 text-bleed ml-2">
                  download failed.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import {
  TWEETS,
  copyCardAndTextWithBlob,
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

type CopyState = "idle" | "copying" | "copied" | "text-only" | "fallback";
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
 * A focused, single-purpose dialog that opens from the approval screen.
 * Hosts the card preview + the two primary actions (Copy Card & Text /
 * Share on X) plus a graceful Download fallback when the image clipboard
 * write fails or isn't available.
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

  const onCopy = useCallback(async () => {
    setCopyState("copying");
    track("share_card_copy_attempt");

    // iOS Safari: skip the image-clipboard route entirely and run the
    // download path so the user actually ends up with a file in their
    // camera roll / Files. Text still goes to clipboard.
    if (isImageClipboardUnreliable()) {
      try {
        const blob = cardBlob ?? (await fetchShareCardBlob(round, wallet));
        downloadShareCardBlob(blob, round);
        try { await navigator.clipboard?.writeText(tweetText); } catch { /* noop */ }
        setCopyState("text-only");
        track("share_card_copy_fallback_ios");
      } catch {
        setCopyState("fallback");
      }
      return;
    }

    // Desktop / non-iOS: use the pre-fetched blob so clipboard.write()
    // runs synchronously inside the click handler. If the prefetch
    // hasn't landed yet (very fast click), fall back to a fresh fetch
    // — slightly less reliable but still works most of the time.
    let blob = cardBlob;
    if (!blob) {
      try { blob = await fetchShareCardBlob(round, wallet); }
      catch { setCopyState("fallback"); return; }
    }

    const res = await copyCardAndTextWithBlob(blob, tweetText);
    if (res.imageOk && res.textOk) {
      setCopyState("copied");
      track("share_card_copied");
    } else if (res.textOk) {
      setCopyState("text-only");
      track("share_card_copy_text_only", { reason: res.imageReason || "unknown" });
    } else {
      setCopyState("fallback");
    }
  }, [round, wallet, tweetText, cardBlob]);

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

  // The "show download fallback" rule: any time the image branch failed
  // — text-only success counts, complete failure counts.
  const showDownloadFallback =
    copyState === "text-only" || copyState === "fallback";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Share Approval Card"
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
          {/* Card preview — square, fills available width up to 420px.
              Decorative; the real PNG is downloaded/copied via the
              actions below. The bg-black + 1px border matches the
              inline preview look used elsewhere. */}
          <div className="border border-border bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shareCardUrl(round, wallet)}
              alt="approval share card preview"
              className="block w-full h-auto"
              width={1200}
              height={1200}
            />
          </div>

          {/* Helper text — italic serif, small, tone matches existing
              hint copy on the apply page. */}
          <p className="font-serif italic text-xxs text-mute leading-relaxed">
            paste in X to include your card.
          </p>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={copyState === "copying"}
              onClick={onCopy}
            >
              {copyState === "copying" ? "Copying…" : "Copy Card & Text"}
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
              card + text copied. open X and paste.
            </p>
          )}
          {copyState === "text-only" && (
            <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed">
              image clipboard unsupported — text copied, save the card below.
            </p>
          )}
          {copyState === "fallback" && (
            <p className="font-mono text-xxxs uppercase tracking-widest2 text-bleed">
              clipboard blocked — save the card below and paste manually.
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

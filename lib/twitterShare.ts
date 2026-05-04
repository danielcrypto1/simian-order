// X (Twitter) share intents. The intent endpoint at twitter.com auto-
// redirects to x.com — we keep the historical URL for compatibility with
// embedded tweet composers and link previewers that still understand it.

const INTENT_URL = "https://twitter.com/intent/tweet?text=";

/** Wraps a piece of pre-composed text into the X share-intent URL. */
export function tweetUrl(text: string): string {
  return INTENT_URL + encodeURIComponent(text);
}

export const TWEETS = {
  /**
   * Five-summoning share. The slate is invitation-only and
   * non-transferable — there's no link, just a pointer to the
   * mystical summoning system.
   */
  summoned: () =>
    `I've completed THE FIVE SUMMONING for SIMIAN ORDER.

The order chooses who walks through.

#SimianOrder`,

  /**
   * Recognition share. Five tone variants — one is chosen at random
   * on each share so the timeline doesn't get a wall of identical
   * tweets. `{round}` is replaced with the active round number at
   * call time so the post pegs the user to a specific cycle.
   */
  approval: (round: number) => {
    const variants: ((r: number) => string)[] = [
      (r) =>
        `RECOGNISED — ROUND ${r}
Entry isn’t given.
It’s seen.
THE FIVE SUMMONING is open.
@SimianOrder
#SimianOrder`,
      (r) =>
        `RECOGNISED.
They saw it.
Round ${r} — unlocked.
The FIVE SUMMONING begins.
@SimianOrder
#SimianOrder`,
      (r) =>
        `RECOGNISED — ROUND ${r}
Most applied.
Few were seen.
I’m in.
@SimianOrder
#SimianOrder`,
      (_r) =>
        `RECOGNISED.
No noise.
No luck.
Just conviction.
@SimianOrder
#SimianOrder`,
      (r) =>
        `RECOGNISED — R${r}
Entry isn’t given.
@SimianOrder
#SimianOrder`,
    ];
    const pick = variants[Math.floor(Math.random() * variants.length)];
    return pick(round);
  },

  rejection: () =>
    `Not recognised by THE HIGH ORDER this round.

Will summon again.

#SimianOrder`,
};

/** Opens the share intent in a new tab. Safe in SSR (no-op without window). */
export function openTweet(text: string): void {
  if (typeof window === "undefined") return;
  window.open(tweetUrl(text), "_blank", "noopener,noreferrer");
}

/**
 * Builds the URL to the dynamic share-card PNG for a given round.
 * Wallet, when supplied, is sent as-is — the API masks it server-side
 * before rendering, so the full address never appears on the card.
 */
export function shareCardUrl(round: number, wallet?: string | null): string {
  const params = new URLSearchParams({ round: String(round) });
  if (wallet) params.set("wallet", wallet);
  return `/api/share-card?${params.toString()}`;
}

/**
 * Triggers a browser download of the share card. Fetches the PNG so we
 * can offer a stable filename ("simian-order-recognised-r{round}.png")
 * and short-circuit if the network fails (we surface the error instead
 * of silently opening a blank tab).
 */
export async function downloadShareCard(round: number, wallet?: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  const blob = await fetchShareCardBlob(round, wallet);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `simian-order-recognised-r${round}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the object URL on the next tick so Safari has a chance
  // to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Internal: fetch the share-card PNG as a Blob. Throws on network fail. */
export async function fetchShareCardBlob(round: number, wallet?: string | null): Promise<Blob> {
  const res = await fetch(shareCardUrl(round, wallet), { cache: "no-store" });
  if (!res.ok) throw new Error(`share_card_${res.status}`);
  return await res.blob();
}

/**
 * Result of the combined image+text clipboard write. The caller uses
 * `imageOk` to decide whether to surface a "Download Card" fallback —
 * if it's false, the clipboard only got the text and the user has no
 * way to paste the image into X. Text writes succeed almost everywhere
 * so `textOk` is rarely false in practice; we still surface it.
 */
export type CopyShareResult = {
  imageOk: boolean;
  textOk: boolean;
  /** Short reason code for the image branch when imageOk is false. */
  imageReason?: "no-clipboard-api" | "no-image-support" | "denied" | "fetch-failed" | "unknown";
};

/**
 * Copies the approval card PNG **and** the prepared tweet text to the
 * system clipboard so the user can paste both into the X composer.
 *
 * Browser support reality:
 *   - Desktop Chrome/Edge/Firefox (recent): supported.
 *   - Safari ≥ 13.4 (iOS + macOS): supports `ClipboardItem` but image
 *     writes are gated by user activation and fail silently in some
 *     contexts. Caller should be ready to fall back to a download.
 *   - Older browsers / non-secure contexts: the API doesn't exist; we
 *     return `imageOk: false` with reason `no-clipboard-api`.
 *
 * Must be invoked from a user-gesture handler (click). We pass the
 * blob fetch through `ClipboardItem`'s promise form on Safari paths
 * where the API insists on the promise to keep the user-activation
 * window open across the network request.
 */
export async function copyCardAndText(
  round: number,
  text: string,
  wallet?: string | null,
): Promise<CopyShareResult> {
  if (typeof navigator === "undefined") {
    return { imageOk: false, textOk: false, imageReason: "no-clipboard-api" };
  }

  // ── Image branch ────────────────────────────────────────────────
  let imageOk = false;
  let imageReason: CopyShareResult["imageReason"];
  const ClipboardItemCtor =
    typeof window !== "undefined"
      ? (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      : undefined;

  if (!navigator.clipboard?.write || !ClipboardItemCtor) {
    imageReason = "no-clipboard-api";
  } else {
    try {
      // Safari requires the ClipboardItem to receive a Promise<Blob>
      // so the user-gesture is preserved across the network fetch.
      // Chrome/Firefox accept either a Blob or a Promise<Blob>.
      const blobPromise = fetchShareCardBlob(round, wallet);
      const item = new ClipboardItemCtor({ "image/png": blobPromise });
      await navigator.clipboard.write([item]);
      imageOk = true;
    } catch (err) {
      // Distinguish fetch failures from permission/support errors so
      // the modal can show a useful message.
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      imageReason =
        msg.includes("share_card") || msg.includes("network") ? "fetch-failed"
        : msg.includes("denied") || msg.includes("permission") ? "denied"
        : msg.includes("type") || msg.includes("not supported") || msg.includes("image/png") ? "no-image-support"
        : "unknown";
    }
  }

  // ── Text branch (independent of image) ──────────────────────────
  let textOk = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      textOk = true;
    }
  } catch {
    /* swallow — surfaced via textOk:false */
  }

  return { imageOk, textOk, imageReason };
}

/**
 * Same as `copyCardAndText` but uses a pre-fetched Blob instead of
 * triggering a network request inside the click handler. This is the
 * preferred entry point for the share modal: pre-fetch on open, then
 * use the cached blob inside the click handler so `clipboard.write()`
 * runs synchronously while user activation is still valid.
 *
 * The Promise<Blob> form of `ClipboardItem` is supposed to preserve the
 * user-gesture across an async fetch, but Chromium has a bug where
 * slow promises (or any promise that reads a network response) cause
 * the write to silently no-op the image branch on production HTTPS.
 * Passing a real Blob avoids that entirely.
 */
export async function copyCardAndTextWithBlob(
  blob: Blob,
  text: string,
): Promise<CopyShareResult> {
  if (typeof navigator === "undefined") {
    return { imageOk: false, textOk: false, imageReason: "no-clipboard-api" };
  }

  let imageOk = false;
  let imageReason: CopyShareResult["imageReason"];
  const ClipboardItemCtor =
    typeof window !== "undefined"
      ? (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      : undefined;

  if (!navigator.clipboard?.write || !ClipboardItemCtor) {
    imageReason = "no-clipboard-api";
  } else {
    try {
      const item = new ClipboardItemCtor({ [blob.type || "image/png"]: blob });
      await navigator.clipboard.write([item]);
      // ── Verify-after-write ────────────────────────────────────────
      // Chromium has a long-standing bug where `clipboard.write` with
      // an image silently no-ops (resolves successfully, image absent
      // from clipboard). Read back to catch this — if the write didn't
      // actually land, mark as failure so the caller surfaces the
      // download fallback instead of telling the user "copied" when
      // nothing was copied.
      try {
        const items = await navigator.clipboard.read();
        const hasImage = items.some((it) =>
          it.types.some((t) => t.startsWith("image/"))
        );
        imageOk = hasImage;
        if (!hasImage) {
          imageReason = "no-image-support";
          // eslint-disable-next-line no-console
          console.warn("[share-card] clipboard.write resolved but readback shows no image — chromium silent-fail");
        }
      } catch {
        // Read may need a separate permission grant. If we can't
        // verify, optimistically trust the write succeeded.
        imageOk = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      imageReason =
        msg.includes("denied") || msg.includes("permission") ? "denied"
        : msg.includes("type") || msg.includes("not supported") || msg.includes("image/png") ? "no-image-support"
        : "unknown";
      // eslint-disable-next-line no-console
      console.warn("[share-card] image clipboard write failed:", err);
    }
  }

  let textOk = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      textOk = true;
    }
  } catch {
    /* swallow */
  }

  return { imageOk, textOk, imageReason };
}

/**
 * Triggers a download from a pre-fetched Blob. Same shape as
 * downloadShareCard but skips the fetch — pair with the cached blob
 * loaded by the modal on open.
 */
export function downloadShareCardBlob(blob: Blob, round: number): void {
  if (typeof window === "undefined") return;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `simian-order-recognised-r${round}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Returns true when the browser supports `navigator.share()` with
 * file attachments — the path that reliably lands an image into the
 * X composer (or Discord, Messages, Mail, etc.) on mobile and modern
 * desktop browsers. Must be re-checked per blob since `canShare`
 * inspects the file's MIME type / size.
 */
export function canShareCardFile(blob: Blob, round: number): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    const file = new File([blob], `simian-order-recognised-r${round}.png`, {
      type: blob.type || "image/png",
    });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Opens the OS share sheet with the card as a real File attachment +
 * the prepared tweet text. On mobile, picking "X" attaches the image
 * directly (no clipboard hop). On Chromium desktops with Web Share
 * Level 2 (Win 11 / ChromeOS), opens the system share dialog.
 *
 * Throws if the user cancels or the platform refuses — caller should
 * fall back to clipboard / download.
 */
export async function shareCardViaDevice(
  blob: Blob,
  text: string,
  round: number,
): Promise<void> {
  const file = new File([blob], `simian-order-recognised-r${round}.png`, {
    type: blob.type || "image/png",
  });
  await navigator.share({
    files: [file],
    text,
    title: `SIMIAN ORDER — Round ${round}`,
  });
}

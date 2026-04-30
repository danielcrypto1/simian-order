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
   * Recognition share. Includes the active round number so the social
   * post pegs the user to a specific round of admissions.
   */
  approval: (round: number) =>
    `Recognised by THE HIGH ORDER — Round ${round}

Entry isn't given.

#SimianOrder`,

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

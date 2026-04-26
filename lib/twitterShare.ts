// X (Twitter) share intents. The intent endpoint at twitter.com auto-
// redirects to x.com — we keep the historical URL for compatibility with
// embedded tweet composers and link previewers that still understand it.

const INTENT_URL = "https://twitter.com/intent/tweet?text=";

/** Wraps a piece of pre-composed text into the X share-intent URL. */
export function tweetUrl(text: string): string {
  return INTENT_URL + encodeURIComponent(text);
}

export const TWEETS = {
  referral: (link: string) =>
    `Just secured access to SIMIAN ORDER.

Entry isn’t given. It’s earned.

Join through my link:
${link}

#SimianOrder`,

  approval: () =>
    `I’ve been accepted into SIMIAN ORDER.

Not everyone gets in.

#SimianOrder`,

  rejection: () =>
    `Didn’t make it into SIMIAN ORDER this time.

Will try again.

#SimianOrder`,
};

/** Opens the share intent in a new tab. Safe in SSR (no-op without window). */
export function openTweet(text: string): void {
  if (typeof window === "undefined") return;
  window.open(tweetUrl(text), "_blank", "noopener,noreferrer");
}

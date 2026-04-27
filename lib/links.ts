// Single source of truth for external links + the navigation registry.
// When you add a new page or change a social URL, update this file —
// it powers SiteFooter, Sidebar, and the admin Link Audit table.

export const SOCIAL = {
  X: "https://x.com/SimianOrder",
  DISCORD: "https://discord.gg/JYJZruds6R",
  APECHAIN: "https://apechain.com",
  OPENSEA: "https://opensea.io/collection/simian-order",
};

export const TASK_LINKS = {
  X_PROFILE: SOCIAL.X,
  // Replace with the actual pinned tweet status URL once it exists.
  PINNED_TWEET: SOCIAL.X,
  DISCORD: SOCIAL.DISCORD,
};

/**
 * OpenSea collection URL. Resolves NEXT_PUBLIC_OPENSEA_URL at build time
 * if the env var is set, otherwise falls back to the static SOCIAL value.
 * Lets ops swap collection slugs (or point to a different marketplace
 * page) without a code push.
 */
export const OPENSEA_URL: string =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_OPENSEA_URL) ||
  SOCIAL.OPENSEA;

/**
 * Site-wide visibility flag for the OpenSea surface.
 *
 *   true  → every <OpenseaLink> renders null; call-site separators
 *           and surrounding "marketplace" copy are gated to also
 *           disappear (see TopBar / SiteFooter / dashboard / etc.)
 *   false → links are restored everywhere as they were.
 *
 * The Web-Audio audio toggle, glitch transition, click logic, and
 * underlying URL constant are all preserved — this is a UI-only mute,
 * easy to flip back on by changing one line.
 *
 * Override via env var `NEXT_PUBLIC_OPENSEA_HIDDEN=0` if/when you want
 * to launch the marketplace surface without a code push.
 */
export const OPENSEA_HIDDEN: boolean =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_OPENSEA_HIDDEN === "0")
    ? false
    : true; // default: hidden

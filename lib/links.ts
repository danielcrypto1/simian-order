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

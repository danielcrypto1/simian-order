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

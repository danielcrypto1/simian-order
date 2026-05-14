// Quest templates — the canonical set of quest types the admin can
// pull onto the checklist. Each template fixes the id + label so the
// admin only ever needs to paste a URL when a new round opens.
//
// Client-safe (no I/O). Imported by both the server-side tasksStore
// (for seed defaults) and the admin Tasks Editor UI (for the "Add
// quest" template picker).

export type QuestTemplate = {
  /** Stable slug used as the task id. Per-user completion flags key
   *  off this — keep it stable across edits. */
  id: string;
  /** Display label rendered on /dashboard/tasks. Locked in here so
   *  the admin can't accidentally paraphrase it round-over-round. */
  label: string;
  /** Placeholder shown in the URL input + the suggested format. Not
   *  saved — purely a UX hint for the editor. */
  urlPlaceholder: string;
  /** One-line note shown under the URL input in the editor so the
   *  admin knows which link to paste. */
  hint: string;
};

export const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: "follow",
    label: "Follow @SimianOrder on X",
    urlPlaceholder: "https://x.com/SimianOrder",
    hint: "the X profile URL.",
  },
  {
    id: "like_retweet",
    label: "Like & Retweet",
    urlPlaceholder: "https://x.com/SimianOrder/status/...",
    hint: "the pinned tweet status URL.",
  },
  {
    id: "tag",
    label: "Tag 2 SIMIANS in pinned post",
    urlPlaceholder: "https://x.com/SimianOrder/status/...",
    hint: "the pinned tweet status URL (same as Like & Retweet).",
  },
  {
    id: "comment",
    label: "Comment on the pinned post",
    urlPlaceholder: "https://x.com/SimianOrder/status/...",
    hint: "the pinned tweet status URL.",
  },
  {
    id: "discord",
    label: "Join the Discord server",
    urlPlaceholder: "https://discord.gg/...",
    hint: "the Discord invite link.",
  },
];

/** Lookup helper for the admin UI — match a stored task id back to
 *  its template (or null for custom tasks the admin made by hand). */
export function templateFor(id: string): QuestTemplate | null {
  return QUEST_TEMPLATES.find((t) => t.id === id) ?? null;
}

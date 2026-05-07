// Pure helpers for the sequential ORDER #N code format used by the
// back-room flow. Lives in its own module (no node:crypto import) so
// client components can pull these in without dragging the whole
// server-side backroomStore into the browser bundle.

export const BACKROOM_TOTAL = 500;

/** Format a 1-based claim index as the canonical display code. */
export function formatOrderCode(index: number): string {
  return `ORDER #${index}`;
}

/** URL-safe slug for an ORDER code (e.g. 7 → "order-7"). */
export function orderSlug(index: number): string {
  return `order-${index}`;
}

/** Parse a slug like "order-7" / "ORDER-7" / "order_7" / "7" → index. */
export function parseOrderSlug(slug: string): number | null {
  if (!slug) return null;
  const m = String(slug).trim().toLowerCase().match(/^(?:order[-_# ]*)?(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > BACKROOM_TOTAL) return null;
  return n;
}

// Pure helpers for back-room code formats. Lives in its own module
// (no node:crypto import) so client components can pull these in
// without dragging the whole server-side backroomStore into the
// browser bundle.
//
// Two code formats are recognised:
//   - Legacy sequential: "ORDER #N" with slug "order-N"  (claims minted
//     before the random-code rollout — still honoured everywhere)
//   - Random: "XXXX-YYYY" using an unambiguous 32-char alphabet,
//     with slug = lowercased code (e.g. "k7x2-pq9f")
//
// New claims are minted with the random format (see generateCode in
// lib/backroomStore.ts). These helpers convert between code <-> slug
// and tolerate both shapes.

export const BACKROOM_TOTAL = 500;

/** Unambiguous alphabet for random codes — drops 0/O/1/I/L to keep
 *  hand-typed codes from getting mangled in tickets. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Random codes look like "K7X2-PQ9F" — 8 alphabet chars + a dash. */
const RANDOM_CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/i;
const LEGACY_SLUG_RE = /^(?:order[-_# ]*)?(\d+)$/i;
const LEGACY_CODE_RE = /^ORDER\s*#(\d+)$/i;

/** Legacy sequential formatter. Preserved for displaying old claims
 *  whose `code` field was minted before the random rollout. */
export function formatOrderCode(index: number): string {
  return `ORDER #${index}`;
}

/** Legacy slug from an index. New code minting uses codeToSlug(code)
 *  instead — this is kept so historical URLs still resolve. */
export function orderSlug(index: number): string {
  return `order-${index}`;
}

/** Parse a legacy `order-N` slug back to its 1-based index, or null
 *  if the slug isn't a legacy shape. Random-code slugs return null. */
export function parseOrderSlug(slug: string): number | null {
  if (!slug) return null;
  const m = String(slug).trim().match(LEGACY_SLUG_RE);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > BACKROOM_TOTAL) return null;
  return n;
}

/** URL-safe slug for a stored code. Routes "ORDER #N" to "order-N"
 *  for backwards-compat and lowercases any other shape (random codes
 *  are kept simple — slug is just the lowercased code). */
export function codeToSlug(code: string): string {
  if (!code) return "";
  const legacy = code.match(LEGACY_CODE_RE);
  if (legacy) return `order-${legacy[1]}`;
  return code.trim().toLowerCase();
}

/** Resolve a URL slug to the display form of the code, accepting
 *  both legacy `order-N` and random `xxxx-yyyy` slugs. Returns null
 *  for clearly-invalid shapes so callers can redirect away. */
export function slugToDisplayCode(slug: string): string | null {
  if (!slug) return null;
  const s = String(slug).trim();
  if (LEGACY_SLUG_RE.test(s)) {
    const idx = parseOrderSlug(s);
    return idx === null ? null : formatOrderCode(idx);
  }
  if (RANDOM_CODE_RE.test(s)) return s.toUpperCase();
  return null;
}

/**
 * Manifest of /public/void/ images for the chaos engine.
 *
 * Hardcoded list (vs. dynamic directory read) because we can't
 * fs-read /public at runtime on Vercel — the manifest is generated
 * once at copy time. If you add/remove files in /public/void/, also
 * update the count + range here.
 *
 * Total: 54 JPEGs (re-encoded from PNG @ 900px max, q=78).
 */
export const VOID_IMAGE_COUNT = 54;

/**
 * Build the URL for a given index (1..VOID_IMAGE_COUNT).
 * Wraps modulo so callers can always pass arbitrary indices.
 */
export function voidImageUrl(i: number): string {
  const n = ((i - 1) % VOID_IMAGE_COUNT + VOID_IMAGE_COUNT) % VOID_IMAGE_COUNT + 1;
  return `/void/${n}.jpg`;
}

/**
 * The full list of image URLs, in deterministic order. Useful for
 * preloading and as a base for shuffle/random-pick at runtime.
 */
export function voidImageList(): string[] {
  const out: string[] = [];
  for (let i = 1; i <= VOID_IMAGE_COUNT; i++) out.push(voidImageUrl(i));
  return out;
}

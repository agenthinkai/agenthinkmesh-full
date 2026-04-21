/**
 * sanitiseSlug — converts a raw deal name into a URL/filename-safe slug.
 *
 * Pipeline:
 *   1. Replace every non-alphanumeric character with a hyphen
 *   2. Collapse consecutive hyphens to a single hyphen
 *   3. Trim leading and trailing hyphens
 *   4. If the result is empty (e.g. all-Arabic or all-emoji input),
 *      fall back to `deal-{fallbackId}`
 *
 * @param name       Raw deal name (may contain Unicode, spaces, punctuation)
 * @param fallbackId Stable identifier used when the slug would be empty
 */
export function sanitiseSlug(name: string, fallbackId: string | number): string {
  const slug = name
    .replace(/[^a-zA-Z0-9]+/g, "-") // step 1 & 2: non-alphanumeric → hyphen (consecutive collapsed)
    .replace(/^-+|-+$/g, "");        // step 3: trim leading/trailing hyphens

  return slug || `deal-${fallbackId}`; // step 4: fallback when empty
}

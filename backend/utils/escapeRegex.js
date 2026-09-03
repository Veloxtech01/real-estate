/**
 * Regex-safety helpers for user-supplied search terms.
 *
 * Every staff-facing search here builds a RegExp from something a person typed. Without
 * escaping, a term like ".*" matches every document, and a pathological term can pin a
 * CPU (ReDoS). This is the only place that turns user input into a pattern.
 */

/**
 * Escape every regex metacharacter in a string.
 *
 * Takes: input (string | null | undefined).
 * Returns: the string with metacharacters backslash-escaped; "" for a nullish input.
 */
export function escapeRegex(input) {
  if (input == null) return "";
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive substring matcher from a user's search term.
 *
 * Takes: input (string) — a raw term straight off the query string.
 * Returns: RegExp matching that term literally, anywhere in a field.
 */
export function buildSearchRegex(input) {
  return new RegExp(escapeRegex(input), "i");
}

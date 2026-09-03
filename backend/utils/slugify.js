/**
 * Slug helpers.
 *
 * Centralised because slugs are the SEO URL contract (§4.1) — three copies of this
 * logic would eventually disagree, and a listing whose slug changes silently loses
 * whatever ranking that URL had.
 */

/**
 * Builds a URL-safe slug fragment.
 *
 * Takes: value (string).
 * Returns: a lowercase hyphenated string with punctuation stripped.
 */
export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds the property URL segment, e.g.
 * "4-bedroom-duplex-lekki-phase-1-ref1042".
 *
 * The reference is appended so two identically-titled listings in the same area
 * can't collide, and so staff can read the reference straight out of a shared URL
 * (§4.1 shows exactly this form).
 *
 * Takes: title (string), reference (string).
 * Returns: the slug.
 */
export function propertySlug(title, reference) {
  return `${slugify(title)}-${slugify(reference)}`;
}

/**
 * URL <-> filter-object translation.
 *
 * The URL is the single source of truth for search state (spec §2.4): it makes a
 * search shareable, indexable, and correct under browser back/forward. This module is
 * the only place that knows which query parameters exist, so an unknown key in the URL
 * can never reach the API.
 */

// Filters passed through as strings, exactly as GET /api/properties expects them.
const STRING_KEYS = [
  "listingType",
  "propertyType",
  "location",
  "state",
  "titleType",
  "isFeatured",
  "q",
  "sort",
];

// Filters coerced to numbers. A non-numeric value is dropped, never forwarded as NaN.
const NUMBER_KEYS = [
  "bedroomsMin",
  "bedroomsMax",
  "bathroomsMin",
  "priceMin",
  "priceMax",
  "page",
  "limit",
];

// Filters that may appear more than once in the URL.
const ARRAY_KEYS = ["amenities"];

export const FILTER_KEYS = [...STRING_KEYS, ...NUMBER_KEYS, ...ARRAY_KEYS];

/**
 * Turn Next's resolved `searchParams` object into a clean filter object.
 * Unknown keys are discarded — this is the whitelist boundary for the URL.
 *
 * @param {Record<string, string|string[]|undefined>} raw
 * @returns {object}
 */
export function parseSearchParams(raw = {}) {
  const filters = {};

  for (const key of STRING_KEYS) {
    const value = raw[key];
    // Next gives an array if the key repeats; take the first for a scalar filter.
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar) filters[key] = scalar;
  }

  for (const key of NUMBER_KEYS) {
    const value = raw[key];
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar == null || scalar === "") continue;
    const parsed = Number(scalar);
    // Dropping a malformed number is safer than sending NaN into a DB query.
    if (Number.isFinite(parsed)) filters[key] = parsed;
  }

  for (const key of ARRAY_KEYS) {
    const value = raw[key];
    if (value == null || value === "") continue;
    filters[key] = Array.isArray(value) ? value : [value];
  }

  return filters;
}

/**
 * Serialise a filter object back to a query string (no leading "?").
 * Empty values are omitted so the URL never carries bare keys.
 */
export function toQueryString(filters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      // Repeat the key per item — matches what parseSearchParams expects back.
      for (const item of value) if (item) params.append(key, String(item));
      continue;
    }
    params.set(key, String(value));
  }

  return params.toString();
}

/**
 * Immutably set or clear one filter.
 *
 * Always resets `page`: staying on page 4 after changing a filter shows an empty or
 * unrelated result set, which reads as a broken search.
 */
export function withFilter(filters, key, value) {
  const next = { ...filters };
  delete next.page;

  const isEmpty =
    value == null || value === "" || (Array.isArray(value) && value.length === 0);
  if (isEmpty) delete next[key];
  else next[key] = value;

  return next;
}

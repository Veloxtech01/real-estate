/**
 * Pure display formatters. No API shapes leak in here — callers pass primitives.
 * Everything the visitor reads as a number goes through this module so the Nigerian
 * conventions (abbreviated prices, square metres, per-annum rent) live in one place.
 */

// Symbols for the currencies the API can emit. Anything else falls back to the code,
// which is honest rather than wrong.
const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$" };

// Keys whose human label a naive underscore-to-space transform would get wrong.
const LABEL_OVERRIDES = {
  c_of_o: "C of O",
  global_c_of_o: "Global C of O",
  governors_consent: "Governor's Consent",
  deed_of_assignment: "Deed of Assignment",
  registered_survey: "Registered Survey",
  boys_quarters: "Boys quarters",
  self_contained: "Self-contained",
  room_and_parlour: "Room and parlour",
  mini_flat: "Mini flat",
  semi_detached: "Semi-detached",
  per_annum: "per year",
  per_quarter: "per quarter",
  per_month: "per month",
};

/**
 * Strip a trailing ".0" so 127.0m renders as 127m.
 * Kept separate because every magnitude branch needs it.
 */
function trimDecimal(value) {
  return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * Format an amount the way Nigerian buyers read prices: "₦150m", not "₦150,000,000"
 * (scope §8.2). Never assumes naira — high-end stock is priced in USD.
 *
 * @param {number} amount
 * @param {string} currency - ISO code from the API (`price.currency`).
 * @returns {string}
 */
export function formatMoney(amount, currency = "NGN") {
  const symbol = CURRENCY_SYMBOLS[currency];
  // An unknown currency gets "GBP 5m" — a wrong symbol would misprice the listing.
  const prefix = symbol ?? `${currency} `;

  if (amount >= 1_000_000_000) return `${prefix}${trimDecimal(amount / 1_000_000_000)}b`;
  if (amount >= 1_000_000) return `${prefix}${trimDecimal(amount / 1_000_000)}m`;
  if (amount >= 1_000) return `${prefix}${trimDecimal(amount / 1_000)}k`;
  // Below a thousand, abbreviating loses information rather than saving space.
  return `${prefix}${amount}`;
}

/**
 * Render a land or floor area. The API stores square metres only — a "plot" means a
 * different area in different parts of Lagos, so we never convert back to plots.
 *
 * @returns {string|null} null when there is no area, so the caller omits the row.
 */
export function formatArea(sqm) {
  if (sqm == null) return null;
  return `${sqm.toLocaleString("en-NG")} m²`;
}

/**
 * Expand a rent period key. `per_annum` is the schema default and the Nigerian norm;
 * rendering it as "/month" understates the rent by twelve times.
 */
export function formatRentPeriod(period) {
  return LABEL_OVERRIDES[period] ?? String(period ?? "").replace(/_/g, " ");
}

/**
 * Turn an API machine key into a human label. The API deliberately sends keys, not
 * labels, so that wording stays a presentation concern.
 */
export function humanise(key) {
  if (!key) return "";
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Count with a naively pluralised noun — adequate for beds/baths/toilets. */
export function formatCount(n, singular) {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/** Render an ISO date string as "1 March 2026" — the blog's publish date. */
export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

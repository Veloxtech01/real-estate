/**
 * Domain enums and whitelists — the single source of truth for controlled values.
 *
 * Everything that constrains a value lives here rather than inline in a schema,
 * because the AI natural-language search (scope doc §5.2 step 4) must validate the
 * model's extracted filters against exactly the same whitelists the database
 * enforces. Two copies of these lists would let the model emit a "valid" filter the
 * DB has never heard of.
 */

/** Sale vs rent. Short-let is a separate module (§6.2) and is deliberately absent. */
export const LISTING_TYPES = ["sale", "rent"];

/** Where a listing is in its commercial lifecycle (§4.2). */
export const LISTING_STATUSES = [
  "available",
  "under_offer",
  "sold",
  "rented",
  "off_market",
];

/** Editorial state, independent of commercial status (§4.2 draft/published). */
export const PUBLICATION_STATES = ["draft", "published"];

/**
 * Canonical property types. Nigerian-specific forms (self-contained, mini flat,
 * room and parlour, BQ) are first-class here, not squeezed into international
 * categories — informal spellings map onto these via location/taxonomy aliases.
 */
export const PROPERTY_TYPES = [
  "apartment", // "flat" — the alias table maps both words here
  "mini_flat",
  "self_contained",
  "room_and_parlour",
  "duplex",
  "terrace",
  "semi_detached",
  "detached",
  "bungalow",
  "penthouse",
  "boys_quarters",
  "land",
  "commercial",
];

/**
 * Land title types (§8.2). Enumerated rather than free text because Nigerian
 * buyers filter on title before anything else.
 */
export const TITLE_TYPES = [
  "c_of_o", // Certificate of Occupancy
  "governors_consent",
  "deed_of_assignment",
  "registered_survey",
  "excision", // requires a gazette number — enforced in the property schema
  "gazette",
  "family_land", // family / customary land
  "global_c_of_o",
];

/** Rent is quoted per annum in Nigeria — that is the default, not per month (§8.2). */
export const RENT_PERIODS = ["per_annum", "per_quarter", "per_month"];

/** Service charge is billed on its own cycle, separate from the rent cycle. */
export const CHARGE_PERIODS = ["per_annum", "per_quarter", "per_month", "one_off"];

/** High-end Lagos/Abuja stock is often quoted in dollars (§8.2). */
export const CURRENCIES = ["NGN", "USD"];

/** Power supply options, including the DisCo grid bands (§8.2). */
export const POWER_SOURCES = [
  "grid_band_a",
  "grid_band_b",
  "grid_band_c",
  "generator",
  "inverter",
  "solar",
  "estate_24_hour",
];

export const WATER_SOURCES = ["borehole", "well", "public_supply", "treated"];

export const METERING_TYPES = ["prepaid", "postpaid", "none"];

/** Genuinely differentiating in Lekki, Ajah and Victoria Island (§8.2). */
export const FLOOD_RISK_LEVELS = ["none", "low", "moderate", "high"];

export const ROAD_CONDITIONS = ["tarred", "graded", "untarred"];

/**
 * Categories for the single tagged taxonomy that replaces the original brief's four
 * overlapping fields — amenities, facilities, features, security (§8.1).
 */
export const TAXONOMY_CATEGORIES = ["amenity", "facility", "security", "feature"];

/** Enquiry inbox pipeline (§4.2). */
export const ENQUIRY_STATUSES = ["new", "contacted", "viewing_booked", "closed"];

/**
 * What the enquirer wants. "list_property" is the landlord/seller supply pipeline
 * from §3 — commercially the most valuable form on the site, so it is a first-class
 * type rather than an untyped message in the same inbox.
 */
export const ENQUIRY_TYPES = [
  "property_enquiry",
  "list_property",
  "valuation_request",
  "general",
];

/** Which page produced the enquiry — feeds the agency's channel reporting. */
export const ENQUIRY_SOURCES = [
  "property_page",
  "contact_page",
  "list_property_page",
  "area_page",
  "agent_page",
  "no_match_alert", // the §5.5 "we don't have this right now" lead capture
];

/** Whether a logged search came from the filter UI or the AI phrase box (§5.7). */
export const SEARCH_SOURCES = ["filter", "ai"];

/** Viewing request lifecycle (§4.2 accept/reject/reschedule). */
export const VIEWING_STATUSES = [
  "requested",
  "accepted",
  "rejected",
  "rescheduled",
  "completed",
  "cancelled",
];

/**
 * Staff roles (§7). "Visitor" is not here — visitors are unauthenticated in Phase 1,
 * and there is no self-service agent registration by design.
 */
export const STAFF_ROLES = ["administrator", "agent"];

/**
 * Land area conversions to square metres, the canonical stored unit (§8.2).
 *
 * A "plot" is not a fixed size, which is exactly why nothing is stored in plots:
 * the same listing would mean different areas in different states.
 */
export const LAND_UNITS_IN_SQM = {
  sqm: 1,
  plot: 648, // commonly quoted figure
  plot_lagos: 464, // parts of Lagos use a materially smaller plot
  acre: 4046.86,
  hectare: 10000,
};

/**
 * Converts a land area into square metres for storage.
 *
 * Takes: value (number), unit (string — a key of LAND_UNITS_IN_SQM).
 * Returns: the area in square metres, rounded to 2dp.
 * Throws: Error when the unit is not recognised, so a bad unit can never be
 *         silently stored as if it were sqm.
 */
export function toSquareMetres(value, unit) {
  const factor = LAND_UNITS_IN_SQM[unit];

  if (!factor) {
    throw new Error(`Unknown land unit: ${unit}`);
  }

  return Math.round(value * factor * 100) / 100;
}

/**
 * Per-state rent rules (§8.2 "Lagos compliance").
 *
 * Kept as a lookup table so other states can differ, rather than hardcoding Lagos's
 * limits into property validation. Lagos State has publicly reiterated that agency
 * fees may not exceed 10% and that demanding more than one year's rent in advance is
 * unlawful — a listing that breaches either is a legal exposure for the client, so
 * this is enforced at write time rather than treated as a display concern.
 *
 * Move this to a `state_rules` collection when an admin needs to edit it without a
 * deployment; the shape is intentionally already collection-ready.
 */
export const STATE_RENT_RULES = {
  Lagos: { maxAgencyFeePct: 10, maxAdvanceYears: 1 },
  // Default applied to any state without an explicit entry. Deliberately permissive:
  // absent a known statutory cap, we don't invent one.
  default: { maxAgencyFeePct: 100, maxAdvanceYears: 10 },
};

/**
 * Looks up the rent rules for a state.
 *
 * Takes: state (string) — e.g. "Lagos".
 * Returns: the matching rule object, or the default rules when the state is unknown.
 */
export function getStateRentRules(state) {
  return STATE_RENT_RULES[state] || STATE_RENT_RULES.default;
}

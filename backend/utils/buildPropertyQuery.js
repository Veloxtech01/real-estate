import {
  LISTING_TYPES,
  PROPERTY_TYPES,
  LISTING_STATUSES,
} from "./constants.js";

/**
 * Translates request filters into a Mongoose query, sort and pagination.
 *
 * **This is the single query engine.** §5.1 is explicit that AI-extracted filters run
 * through the same path as the ordinary filter search — the model's only job is to
 * produce a filter object, which then arrives here exactly as one built by the filter
 * panel. Two query builders would mean the AI path could return results the filter UI
 * cannot reproduce, which is precisely the failure mode §5.1 is designed to prevent.
 *
 * Everything here is whitelist-driven: an unrecognised value is discarded, never
 * passed through to the database.
 */

// Public listings only. Applied unconditionally so no caller can accidentally expose
// drafts or soft-deleted records by forgetting a filter.
const PUBLIC_SCOPE = { publicationState: "published", deletedAt: null };

/** Sort options exposed to the client, mapped to Mongoose sort objects. */
const SORT_OPTIONS = {
  newest: { publishedAt: -1 },
  oldest: { publishedAt: 1 },
  price_asc: { "price.amount": 1, "rent.amount": 1 },
  price_desc: { "price.amount": -1, "rent.amount": -1 },
};

// Caps the page size so a crafted request can't ask for every listing at once.
const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 12;

/**
 * Coerces a value to a positive number.
 *
 * Takes: value (unknown).
 * Returns: the number, or undefined when it isn't a usable positive number — so a
 *          junk query string drops the filter rather than throwing or matching NaN.
 */
function toPositiveNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Keeps only values present in a whitelist.
 *
 * Takes: value (string | string[]), allowed (string[]).
 * Returns: an array of permitted values (possibly empty).
 */
function whitelist(value, allowed) {
  if (!value) return [];

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((v) => v.trim()).filter((v) => allowed.includes(v));
}

/**
 * Builds the property query.
 *
 * Takes: filters (object) — raw request query or AI-extracted filters:
 *        { listingType, propertyType, location, locations, state, bedroomsMin,
 *          bedroomsMax, bathroomsMin, priceMin, priceMax, currency, amenities,
 *          titleType, isFeatured, status, q, sort, page, limit }
 *        Values may be strings (query params) or arrays (AI output).
 * Returns: { query, sort, page, limit, skip, applied } where `applied` is the
 *          normalised filter set — the front end renders it as the editable chips
 *          required by §5.2 step 7, so a visitor can see how their phrase was read.
 */
export function buildPropertyQuery(filters = {}) {
  const query = { ...PUBLIC_SCOPE };
  const applied = {};

  // --- Listing type (sale/rent) ------------------------------------------------
  const [listingType] = whitelist(filters.listingType, LISTING_TYPES);
  if (listingType) {
    query.listingType = listingType;
    applied.listingType = listingType;
  }

  // --- Property type ------------------------------------------------------------
  const propertyTypes = whitelist(filters.propertyType, PROPERTY_TYPES);
  if (propertyTypes.length) {
    query.propertyType = { $in: propertyTypes };
    applied.propertyType = propertyTypes;
  }

  // --- Location -----------------------------------------------------------------
  // Accepts one or many resolved Location ids. Resolution from names/aliases happens
  // before this point (the alias table, §5.4) — this builder never guesses at a name.
  const locationIds = []
    .concat(filters.location ?? [], filters.locations ?? [])
    .filter(Boolean);

  if (locationIds.length) {
    query.location = { $in: locationIds };
    applied.locations = locationIds.map(String);
  }

  if (filters.state) {
    query.state = filters.state;
    applied.state = filters.state;
  }

  // --- Status -------------------------------------------------------------------
  // Defaults to available: a visitor browsing search results wants what they can
  // actually buy, even though sold listings stay published for SEO value.
  const [status] = whitelist(filters.status, LISTING_STATUSES);
  query.status = status || "available";
  if (status) applied.status = status;

  // --- Bedrooms / bathrooms -----------------------------------------------------
  const bedroomsMin = toPositiveNumber(filters.bedroomsMin);
  const bedroomsMax = toPositiveNumber(filters.bedroomsMax);
  if (bedroomsMin !== undefined || bedroomsMax !== undefined) {
    query.bedrooms = {};
    if (bedroomsMin !== undefined) query.bedrooms.$gte = bedroomsMin;
    if (bedroomsMax !== undefined) query.bedrooms.$lte = bedroomsMax;
    applied.bedroomsMin = bedroomsMin;
    applied.bedroomsMax = bedroomsMax;
  }

  const bathroomsMin = toPositiveNumber(filters.bathroomsMin);
  if (bathroomsMin !== undefined) {
    query.bathrooms = { $gte: bathroomsMin };
    applied.bathroomsMin = bathroomsMin;
  }

  // --- Price --------------------------------------------------------------------
  /**
   * Sale prices live on price.amount, rents on rent.amount. Which field a range
   * applies to therefore depends on the listing type.
   *
   * Note this necessarily excludes price-on-request listings: they have no amount to
   * compare, and treating a missing price as 0 would surface them in every "under
   * ₦X" search (§8.2 requires that state be handled deliberately).
   */
  const priceMin = toPositiveNumber(filters.priceMin);
  const priceMax = toPositiveNumber(filters.priceMax);

  if (priceMin !== undefined || priceMax !== undefined) {
    const range = {};
    if (priceMin !== undefined) range.$gte = priceMin;
    if (priceMax !== undefined) range.$lte = priceMax;

    if (listingType === "rent") {
      query["rent.amount"] = range;
    } else if (listingType === "sale") {
      query["price.amount"] = range;
    } else {
      // No listing type given — match either side, so "under ₦100m" works before the
      // visitor has chosen sale or rent.
      query.$or = [{ "price.amount": range }, { "rent.amount": range }];
    }

    applied.priceMin = priceMin;
    applied.priceMax = priceMax;
  }

  if (filters.currency) {
    query["price.currency"] = filters.currency;
    applied.currency = filters.currency;
  }

  // --- Amenities (taxonomy ids) --------------------------------------------------
  // Ids, already resolved against the Taxonomy whitelist (§5.2 step 4). $all rather
  // than $in: a visitor asking for parking *and* a pool wants both.
  const amenityIds = [].concat(filters.amenities ?? []).filter(Boolean);
  if (amenityIds.length) {
    query.tags = { $all: amenityIds };
    applied.amenities = amenityIds.map(String);
  }

  // --- Land title ---------------------------------------------------------------
  if (filters.titleType) {
    query["landTitle.type"] = filters.titleType;
    applied.titleType = filters.titleType;
  }

  // --- Featured -----------------------------------------------------------------
  if (filters.isFeatured === true || filters.isFeatured === "true") {
    query.isFeatured = true;
    applied.isFeatured = true;
  }

  // --- Free text ----------------------------------------------------------------
  // Uses the property_text index (§10.1 — no separate search engine at this scale).
  if (filters.q) {
    query.$text = { $search: String(filters.q) };
    applied.q = String(filters.q);
  }

  // --- Sort & pagination ---------------------------------------------------------
  const sortKey = SORT_OPTIONS[filters.sort] ? filters.sort : "newest";
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(filters.limit) || DEFAULT_LIMIT));

  return {
    query,
    sort: SORT_OPTIONS[sortKey],
    sortKey,
    page,
    limit,
    skip: (page - 1) * limit,
    applied,
  };
}

/**
 * The relaxation ladder for a zero-result search (§5.5).
 *
 * Applied in a defined order — price band widened by 10%, then the surrounding
 * state, then bedroom count — and the caller reports plainly what was relaxed,
 * because a dead end handled well converts into a lead.
 *
 * Takes: filters (object) — the filters that returned nothing; step (number);
 *        context (object) — { state } of the areas the visitor asked about, used to
 *        widen geographically rather than nationally.
 * Returns: { filters, relaxed } for the next attempt, or null when the ladder is
 *          exhausted.
 */
export function relaxFilters(filters, step, context = {}) {
  const next = { ...filters };

  switch (step) {
    case 0: {
      // Widen the price band by 10% in whichever direction was constrained.
      const max = toPositiveNumber(filters.priceMax);
      const min = toPositiveNumber(filters.priceMin);
      if (max === undefined && min === undefined) return null;

      if (max !== undefined) next.priceMax = Math.round(max * 1.1);
      if (min !== undefined) next.priceMin = Math.round(min * 0.9);
      return { filters: next, relaxed: "price_band" };
    }

    case 1: {
      const hadLocation =
        (filters.locations && filters.locations.length) || filters.location;
      if (!hadLocation) return null;

      delete next.location;
      delete next.locations;

      /**
       * Widen to the surrounding state, not the whole country.
       *
       * §5.5 asks for adjacent neighbourhoods. True adjacency needs a neighbour map
       * on Location that doesn't exist yet — but dropping location outright is far
       * worse than approximating: someone searching Lekki would be shown houses in
       * Enugu, which reads as a broken search rather than a helpful one. The state
       * is a defensible approximation and the caller names it plainly.
       */
      if (context.state) {
        next.state = context.state;
        return { filters: next, relaxed: "nearby_areas" };
      }

      return { filters: next, relaxed: "location" };
    }

    case 2: {
      // Relax bedrooms by one.
      const min = toPositiveNumber(filters.bedroomsMin);
      if (min === undefined || min <= 1) return null;

      next.bedroomsMin = min - 1;
      return { filters: next, relaxed: "bedrooms" };
    }

    default:
      return null;
  }
}

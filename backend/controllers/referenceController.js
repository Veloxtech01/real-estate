import Location from "../model/locationModel.js";
import Agent from "../model/agentModel.js";
import Taxonomy from "../model/taxonomyModel.js";
import Property from "../model/propertyModel.js";
import Settings from "../model/settingsModel.js";
import ApiError from "../utils/ApiError.js";
import {
  LISTING_TYPES,
  LISTING_STATUSES,
  PUBLICATION_STATES,
  PROPERTY_TYPES,
  TITLE_TYPES,
  RENT_PERIODS,
  CHARGE_PERIODS,
  CURRENCIES,
  POWER_SOURCES,
  WATER_SOURCES,
  METERING_TYPES,
  FLOOD_RISK_LEVELS,
  ROAD_CONDITIONS,
  LAND_UNITS_IN_SQM,
  STATE_RENT_RULES,
  STAFF_ROLES,
} from "../utils/constants.js";

/**
 * Reference data endpoints — the vocabulary the front end needs to render filters,
 * area pages and the site chrome.
 *
 * Grouped in one controller because none of them own a resource; they expose the
 * whitelists the search already validates against, so the filter panel offers
 * exactly the values a query can accept.
 */

/**
 * GET /api/locations — areas the agency covers (§3 "Areas we cover").
 *
 * Takes: (req, res); optional req.query.state and req.query.published.
 * Returns: nothing; sends { success, data: { locations } }.
 */
export async function listLocations(req, res) {
  const query = {};

  if (req.query.state) query.state = req.query.state;

  // Area landing pages are only linkable once a client has written their copy, but
  // the filter panel needs every area regardless — hence an explicit flag rather
  // than a blanket published-only default.
  if (req.query.published === "true") query.isPublished = true;

  const locations = await Location.find(query)
    .select("name slug state lga description isPublished")
    .sort({ state: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, data: { locations } });
}

/**
 * GET /api/locations/:slug — a single area landing page, with its listings count.
 *
 * Takes: (req, res); req.params.slug.
 * Returns: nothing; sends { success, data: { location, propertyCount } }.
 * Throws: ApiError 404 when the area does not exist.
 */
export async function getLocationBySlug(req, res) {
  const location = await Location.findOne({ slug: req.params.slug }).lean();

  // An unpublished area 404s identically to an unknown slug — same draft/deleted
  // parity every other public resource (properties, agents, blog) already has, so its
  // URL can't be browsed before a client supplies real copy.
  if (!location || !location.isPublished) {
    throw new ApiError(404, "Location not found");
  }

  // Drives the "12 properties in Lekki Phase 1" line, and lets the page render an
  // honest empty state rather than an empty grid.
  const propertyCount = await Property.countDocuments({
    location: location._id,
    publicationState: "published",
    deletedAt: null,
    status: "available",
  });

  res.status(200).json({ success: true, data: { location, propertyCount } });
}

/**
 * GET /api/taxonomy — amenities, facilities, features and security terms (§8.1).
 *
 * Takes: (req, res); optional req.query.category.
 * Returns: nothing; sends { success, data: { taxonomy } } grouped by category, which
 *          is how the filter panel renders it.
 */
export async function listTaxonomy(req, res) {
  const query = { isActive: true };
  if (req.query.category) query.category = req.query.category;

  const terms = await Taxonomy.find(query)
    .select("key name category icon displayOrder")
    .sort({ category: 1, displayOrder: 1, name: 1 })
    .lean();

  // Grouped server-side so every consumer doesn't reimplement the same reduce.
  const grouped = terms.reduce((accumulator, term) => {
    accumulator[term.category] ??= [];
    accumulator[term.category].push(term);
    return accumulator;
  }, {});

  res.status(200).json({ success: true, data: { taxonomy: grouped } });
}

/**
 * GET /api/filters — everything the search UI needs to build its controls.
 *
 * One request rather than four, because the filter panel is above the fold on the
 * homepage and every extra round trip costs on a mid-range Android over a poor
 * connection (§10.3).
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { listingTypes, propertyTypes, titleTypes,
 *          rentPeriods, currencies, locations, taxonomy, priceRange } }.
 */
export async function getFilterOptions(_req, res) {
  const [locations, taxonomy, priceBounds] = await Promise.all([
    Location.find({}).select("name slug state").sort({ state: 1, name: 1 }).lean(),
    Taxonomy.find({ isActive: true }).select("key name category").sort({ category: 1, displayOrder: 1 }).lean(),

    // Real bounds from live stock, so the price slider matches what exists rather
    // than an arbitrary hardcoded ceiling.
    Property.aggregate([
      { $match: { publicationState: "published", deletedAt: null, status: "available" } },
      {
        $group: {
          _id: "$listingType",
          min: { $min: { $ifNull: ["$price.amount", "$rent.amount"] } },
          max: { $max: { $ifNull: ["$price.amount", "$rent.amount"] } },
        },
      },
    ]),
  ]);

  // Reshape the aggregate into { sale: {min,max}, rent: {min,max} } — sale and rent
  // price ranges differ by orders of magnitude and need separate sliders.
  const priceRange = priceBounds.reduce((accumulator, row) => {
    accumulator[row._id] = { min: row.min ?? 0, max: row.max ?? 0 };
    return accumulator;
  }, {});

  res.status(200).json({
    success: true,
    data: {
      listingTypes: LISTING_TYPES,
      propertyTypes: PROPERTY_TYPES,
      titleTypes: TITLE_TYPES,
      rentPeriods: RENT_PERIODS,
      currencies: CURRENCIES,
      locations,
      taxonomy,
      priceRange,
    },
  });
}

/**
 * GET /api/settings — public site configuration.
 *
 * Serves the §9 theme block plus contact details and the compliance numbers the
 * footer must display (LASRERA, §11). Deliberately a curated projection: the
 * settings document also holds the AI spend cap and analytics ids, which are
 * operational, not public.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { settings } }.
 */
export async function getPublicSettings(_req, res) {
  const settings = await Settings.get();

  res.status(200).json({
    success: true,
    data: {
      settings: {
        agencyName: settings.agencyName,
        tagline: settings.tagline,
        lasreraNumber: settings.lasreraNumber,
        registrationNumbers: settings.registrationNumbers,
        email: settings.email,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        coordinates: settings.coordinates,
        officeHours: settings.officeHours,
        socialLinks: settings.socialLinks,
        theme: settings.theme,
        footerText: settings.footerText,
        listingDisclaimer: settings.listingDisclaimer,
        // Only whether AI search is available — never the cap or current spend.
        aiSearchEnabled: settings.aiSearch?.enabled ?? false,
      },
    },
  });
}


/**
 * GET /api/admin/reference — the vocabulary the listing editor needs.
 *
 * Everything here is already in constants.js, and that is the point: the editor must
 * offer exactly the values the schema enums and the AI-search validator accept. A
 * mirrored copy in the front end would drift the first time an enum gained a member.
 *
 * Deliberately authenticated rather than folded into /api/filters: listing statuses,
 * publication states, the statutory rent table and the staff roster are operational
 * data, and the public filter payload should carry only what a visitor filters by.
 *
 * Takes: (req, res) — requires a session (req.user).
 * Returns: nothing; sends { success, data: { ...enums, stateRentRules, agents? } }.
 */
export async function getAdminReference(req, res) {
  /**
   * The roster is administrator-only. An agent cannot reassign ownership — the
   * controller forces their own id — so serving them a colleague list would expose
   * the staff directory for no functional gain.
   */
  const agents =
    req.user.role === "administrator"
      ? await Agent.find({ isActive: true })
          .select("name slug canPublish isActive")
          .sort({ name: 1 })
          .lean()
      : undefined;

  /**
   * Areas and taxonomy come along too, so the editor preloads in one request.
   *
   * They overlap with /api/filters, but the editor must not depend on a payload shaped
   * for visitors: that one is free to drop a field no searcher uses, and the editor
   * still has to be able to file a listing under it.
   */
  const [locations, taxonomy] = await Promise.all([
    Location.find({}).select("name slug state").sort({ state: 1, name: 1 }).lean(),
    Taxonomy.find({ isActive: true })
      .select("key name category")
      .sort({ category: 1, displayOrder: 1 })
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      listingTypes: LISTING_TYPES,
      listingStatuses: LISTING_STATUSES,
      publicationStates: PUBLICATION_STATES,
      propertyTypes: PROPERTY_TYPES,
      titleTypes: TITLE_TYPES,
      rentPeriods: RENT_PERIODS,
      chargePeriods: CHARGE_PERIODS,
      currencies: CURRENCIES,
      powerSources: POWER_SOURCES,
      waterSources: WATER_SOURCES,
      meteringTypes: METERING_TYPES,
      floodRiskLevels: FLOOD_RISK_LEVELS,
      roadConditions: ROAD_CONDITIONS,

      /**
       * The full unit → sqm map, not just its keys.
       *
       * The API accepts only `landSizeSqm`, so the editor has to convert before
       * submitting — and serving the factors is what stops it hardcoding its own copy
       * of them. That matters here specifically: a "plot" is ~648 sqm generally but
       * ~464 sqm in parts of Lagos, so a drifted client factor would silently store
       * the wrong area.
       */
      landUnits: LAND_UNITS_IN_SQM,

      // The whole table, including its default entry, so the form can warn about a
      // Lagos agency fee before paying for the round trip. The server still decides.
      stateRentRules: STATE_RENT_RULES,

      // The staff form's role <select> reads this rather than hardcoding a copy —
      // same "enum lists are never mirrored" rule as every other admin dropdown.
      staffRoles: STAFF_ROLES,

      locations,
      taxonomy,

      // Absent, not null, for an agent — the key simply isn't part of their payload.
      ...(agents ? { agents } : {}),
    },
  });
}

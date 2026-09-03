import Location from "../model/locationModel.js";
import Taxonomy from "../model/taxonomyModel.js";
import Property from "../model/propertyModel.js";
import Settings from "../model/settingsModel.js";
import ApiError from "../utils/ApiError.js";
import {
  LISTING_TYPES,
  PROPERTY_TYPES,
  TITLE_TYPES,
  RENT_PERIODS,
  CURRENCIES,
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

  if (!location) {
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

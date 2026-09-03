import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";
import SearchLog from "../model/searchLogModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { buildPropertyQuery, relaxFilters } from "../utils/buildPropertyQuery.js";
import { resolveLocations, resolveAmenities } from "../utils/resolveFilters.js";

/**
 * Fields safe to expose on a public listing card or detail page.
 *
 * An explicit projection rather than a blanket document: `documents` is already
 * select:false, but naming the public shape here means a field added to the schema
 * later doesn't become public by default.
 */
const PUBLIC_POPULATE = [
  { path: "location", select: "name slug state lga" },
  { path: "agent", select: "name slug photo phone whatsapp position" },
  { path: "coverImage", select: "url thumbnailUrl blurDataUrl alt width height" },
  { path: "tags", select: "key name category icon" },
];

/**
 * Runs a property search, walking the §5.5 relaxation ladder when nothing matches.
 *
 * Takes: filters (object) — normalised filters including resolved ids.
 * Returns: a promise resolving to { properties, total, applied, relaxed } where
 *          `relaxed` names each constraint that had to be loosened.
 */
async function searchWithRelaxation(filters, context = {}) {
  const relaxed = [];
  let current = { ...filters };
  // Captured from the first attempt only: the chips must reflect what the visitor
  // asked for, not the widened version used to find results (§5.5 reports the
  // widening separately).
  let requested = null;

  // Up to four attempts: the original, then each rung of the ladder.
  for (let step = 0; step <= 3; step += 1) {
    const { query, sort, page, limit, skip, applied } = buildPropertyQuery(current);

    requested ??= applied;

    const [properties, total] = await Promise.all([
      Property.find(query).populate(PUBLIC_POPULATE).sort(sort).skip(skip).limit(limit).lean(),
      Property.countDocuments(query),
    ]);

    // Found something, or this was the last rung — return what we have.
    if (total > 0 || step === 3) {
      return { properties, total, applied: requested, relaxed, page, limit };
    }

    // Nothing matched: loosen one constraint and try again. Showing the closest
    // available alternatives beats an empty page (§5.5).
    const next = relaxFilters(current, step, context);
    if (!next) continue;

    current = next.filters;
    relaxed.push(next.relaxed);
  }

  // Unreachable in practice — the loop always returns on its final iteration.
  return { properties: [], total: 0, applied: {}, relaxed, page: 1, limit: 12 };
}

/**
 * Records a search for the §5.7 demand report.
 *
 * Deliberately fire-and-forget: an analytics write must never fail a visitor's
 * search. No personal data is passed — see the note on searchLogModel.
 *
 * Takes: entry (object) — { rawQuery, filters, resultCount, source, relaxed }.
 * Returns: nothing.
 */
function logSearch(entry) {
  SearchLog.create({
    rawQuery: entry.rawQuery,
    normalizedQuery: entry.rawQuery?.trim().toLowerCase().replace(/\s+/g, " "),
    filters: entry.filters,
    resultCount: entry.resultCount,
    source: entry.source,
    relaxedConstraints: entry.relaxed ?? [],
  }).catch((error) => {
    logger.warn(`Failed to log search: ${error.message}`);
  });
}

/**
 * GET /api/properties — public property search.
 *
 * Query params: listingType, propertyType, location (slug/name/alias), state,
 * bedroomsMin, bedroomsMax, bathroomsMin, priceMin, priceMax, amenities, titleType,
 * isFeatured, q, sort, page, limit.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: { properties, pagination, applied, relaxed } }.
 */
export async function listProperties(req, res) {
  // Resolve human-facing values to ids first — this is the whitelist boundary, and
  // anything unrecognised is dropped rather than queried on (§5.2 step 4).
  const [locations, amenities] = await Promise.all([
    resolveLocations(req.query.location ?? req.query.locations),
    resolveAmenities(req.query.amenities),
  ]);

  const filters = {
    ...req.query,
    locations: locations.ids,
    amenities: amenities.ids,
  };
  // The raw params are replaced by resolved ids; leaving them would double-filter.
  delete filters.location;

  const result = await searchWithRelaxation(filters, {
    // Lets a zero-result search widen to the surrounding state rather than the
    // whole country.
    state: locations.matched[0]?.state,
  });

  logSearch({
    rawQuery: req.query.q,
    filters: result.applied,
    resultCount: result.total,
    source: "filter",
    relaxed: result.relaxed,
  });

  res.status(200).json({
    success: true,
    data: {
      properties: result.properties,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
      /**
       * The interpreted filters, returned so the front end can render them as
       * removable chips (§5.2 step 7) — the visitor sees how their request was
       * understood and can correct it.
       */
      applied: {
        ...result.applied,
        locations: locations.matched,
        amenities: amenities.matched,
      },
      // Named plainly so the UI can say what was widened, per §5.5.
      relaxed: result.relaxed,
      // Lets the UI say "we don't cover Yenagoa" instead of silently ignoring it.
      unmatched: [...locations.unmatched, ...amenities.unmatched],
    },
  });
}

/**
 * GET /api/properties/:slug — public property detail.
 *
 * Takes: (req, res) — Express handler; req.params.slug is the SEO URL segment.
 * Returns: nothing; sends { success, data: { property, gallery, similar } }.
 * Throws: ApiError 404 when no published listing matches.
 */
export async function getPropertyBySlug(req, res) {
  const property = await Property.findOne({
    slug: req.params.slug,
    publicationState: "published",
    deletedAt: null,
  })
    .populate(PUBLIC_POPULATE)
    .lean();

  // A draft or soft-deleted listing must 404 exactly like a non-existent one — a
  // different response would leak that the reference exists.
  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  // Gallery and related listings are fetched alongside so the detail page renders in
  // one round trip.
  const [gallery, similar] = await Promise.all([
    PropertyMedia.find({ property: property._id }).sort({ displayOrder: 1 }).lean(),

    // "Related listings" per §5: same area and listing type, excluding this one.
    Property.find({
      _id: { $ne: property._id },
      location: property.location?._id,
      listingType: property.listingType,
      publicationState: "published",
      deletedAt: null,
      status: "available",
    })
      .populate(PUBLIC_POPULATE)
      .limit(4)
      .lean(),
  ]);

  // Counted out-of-band so a page view never blocks the response.
  Property.updateOne({ _id: property._id }, { $inc: { viewCount: 1 } }).catch((error) => {
    logger.warn(`Failed to increment view count: ${error.message}`);
  });

  res.status(200).json({ success: true, data: { property, gallery, similar } });
}

/**
 * GET /api/properties/featured — homepage featured rail (§4.1).
 *
 * A separate endpoint rather than a filter flag because the homepage needs it
 * without pagination and with a fixed small limit.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: { properties } }.
 */
export async function listFeaturedProperties(req, res) {
  const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 6));

  const properties = await Property.find({
    isFeatured: true,
    publicationState: "published",
    deletedAt: null,
    status: "available",
  })
    .populate(PUBLIC_POPULATE)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();

  res.status(200).json({ success: true, data: { properties } });
}

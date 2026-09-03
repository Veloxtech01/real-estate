import Property from "../model/propertyModel.js";
import SearchLog from "../model/searchLogModel.js";
import QueryCache from "../model/queryCacheModel.js";
import Settings from "../model/settingsModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { buildPropertyQuery, relaxFilters } from "../utils/buildPropertyQuery.js";
import {
  resolveLocations,
  resolveAmenities,
  matchLocationsInPhrase,
  matchAmenitiesInPhrase,
} from "../utils/resolveFilters.js";
import { parseNigerianPhrase, normalizePhrase } from "../utils/nigerianPhraseParser.js";
import { extractFilters } from "../utils/aiSearchClient.js";

/**
 * Natural-language property search (§5).
 *
 * The pipeline follows §5.2 exactly:
 *   1. Visitor submits a phrase.
 *   2. Phrase normalised, checked against the parse cache.
 *   3. On a miss, the deterministic parser runs; only if that leaves the request
 *      under-specified does it reach the model, with a strict output schema.
 *   4. Output validated against whitelists — unrecognised values discarded.
 *   5. Validated filters run as an ordinary indexed query.
 *   6. Real listing records returned.
 *   7. Interpreted filters returned as editable chips.
 *
 * Step 3's deterministic pre-pass is an addition to the scope doc's flow. §5.6
 * demands most searches never reach the model; a regex that parses "₦100m"
 * identically every time is both free and more reliable than a model call.
 */

/** Same public projection the ordinary search uses — one card shape everywhere. */
const PUBLIC_POPULATE = [
  { path: "location", select: "name slug state lga" },
  { path: "agent", select: "name slug photo phone whatsapp position" },
  { path: "coverImage", select: "url thumbnailUrl blurDataUrl alt width height" },
  { path: "tags", select: "key name category icon" },
];

/**
 * Merges model-extracted filters into deterministically parsed ones.
 *
 * The parser wins every conflict. A regex that matched "₦100m" is exact; the model
 * is inference. The model's value is filling fields the parser has no rules for —
 * chiefly location and amenity names.
 *
 * Takes: parsed (object), fromModel (object).
 * Returns: the merged filter object.
 */
function mergeFilters(parsed, fromModel) {
  return { ...fromModel, ...parsed };
}

/**
 * Decides whether the model is worth calling, and whether it is even permitted.
 *
 * Takes: settings (Settings doc), dimensions (number) — how many constraints the
 *        deterministic parser understood.
 * Returns: { use, reason }.
 */
function shouldCallModel(settings, dimensions) {
  const ai = settings.aiSearch ?? {};

  // The kill switch (§5.6). With it off, the phrase box still works — it just runs
  // on the deterministic parser alone.
  if (!ai.enabled) return { use: false, reason: "disabled" };

  // The hard monthly spend cap. Reaching it disables the feature rather than
  // running up an uncapped bill on a public endpoint.
  if (ai.monthlySpendCapUsd > 0 && ai.currentSpendUsd >= ai.monthlySpendCapUsd) {
    return { use: false, reason: "spend_cap_reached" };
  }

  // A phrase the parser already understood along two or more axes doesn't need a
  // model call — that's a paid request to confirm what we know.
  if (dimensions >= 2) return { use: false, reason: "parser_sufficient" };

  return { use: true, reason: "parser_insufficient" };
}

/**
 * Adds a call's cost to the running monthly total.
 *
 * Best-effort: an accounting write must not fail a visitor's search. The cap is
 * checked on the next request, so a lost increment delays enforcement rather than
 * defeating it.
 *
 * Takes: costUsd (number).
 * Returns: nothing.
 */
function recordSpend(costUsd) {
  if (!costUsd) return;

  Settings.updateOne({ key: "site" }, { $inc: { "aiSearch.currentSpendUsd": costUsd } }).catch(
    (error) => logger.warn(`Failed to record AI spend: ${error.message}`)
  );
}

/**
 * POST /api/search — natural-language property search.
 *
 * Body: { q, page?, limit?, sort? }
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: { properties, pagination, applied,
 *          relaxed, unmatched, interpretation } }.
 * Throws: ApiError 400 when the phrase is missing or too long.
 */
export async function naturalLanguageSearch(req, res) {
  const rawQuery = req.body?.q ?? req.query?.q;

  if (!rawQuery || !String(rawQuery).trim()) {
    throw new ApiError(400, "A search phrase is required");
  }

  // Bounded before anything else: this is untrusted public input, and an unbounded
  // string would be sent to a paid model.
  if (String(rawQuery).length > 500) {
    throw new ApiError(400, "Search phrase is too long");
  }

  const normalized = normalizePhrase(rawQuery);
  const settings = await Settings.get();

  const startedAt = Date.now();
  let cacheHit = false;
  let parsedBy = "parser";

  // --- 2. Cache lookup ---------------------------------------------------------
  const cached = await QueryCache.findOne({ normalizedQuery: normalized });
  let filters;

  if (cached) {
    cacheHit = true;
    parsedBy = cached.parsedBy;
    filters = cached.filters;

    // Best-effort usage accounting — the hit rate is the §5.6 cost metric.
    QueryCache.updateOne(
      { _id: cached._id },
      { $inc: { hits: 1 }, $set: { lastUsedAt: new Date() } }
    ).catch(() => {});
  } else {
    // --- 3. Deterministic parse, then the model only if needed -----------------
    const parsed = parseNigerianPhrase(rawQuery);
    filters = parsed.filters;

    const decision = shouldCallModel(settings, parsed.dimensions);

    if (decision.use) {
      const result = await extractFilters(rawQuery, {
        timeoutMs: settings.aiSearch?.timeoutMs || 2000,
      });

      // Charged against the monthly cap whether or not the call produced usable
      // filters — a failed call still cost money.
      recordSpend(result.costUsd ?? 0);

      if (result.ok) {
        filters = mergeFilters(parsed.filters, result.filters);
        parsedBy = parsed.dimensions > 0 ? "hybrid" : "model";
      }
      // On failure we simply keep the deterministic filters — the filter interface
      // stays fully functional, which §5.6 requires.
    }

    // Cache the parse, not the results: listings change constantly, the meaning of
    // a phrase does not.
    await QueryCache.updateOne(
      { normalizedQuery: normalized },
      { $set: { filters, parsedBy, lastUsedAt: new Date() }, $setOnInsert: { hits: 0 } },
      { upsert: true }
    ).catch((error) => logger.warn(`Failed to cache parse: ${error.message}`));
  }

  // --- 4. Validate against the database whitelists -----------------------------
  /**
   * Two sources feed this, and both end at the same whitelist.
   *
   * `resolve*` handles names the parser or the model produced. `match*InPhrase`
   * scans the raw phrase against the client's own vocabulary, which is what makes
   * "3 bedroom flat in Lekki" find Lekki with the model switched off — the default
   * state, and the state the spend cap forces the site back into (§5.6).
   *
   * Either way, anything not present in the locations table or the taxonomy has no
   * id to contribute and is discarded rather than queried on (§5.2 step 4).
   */
  const [named, namedAmenities, scanned, scannedAmenities] = await Promise.all([
    resolveLocations(filters.locations ?? filters.location),
    resolveAmenities(filters.amenities),
    matchLocationsInPhrase(rawQuery),
    matchAmenitiesInPhrase(rawQuery),
  ]);

  /**
   * Unions two resolution results, de-duplicating by id.
   *
   * Takes: a, b — { ids, matched, unmatched? } results.
   * Returns: a merged result.
   */
  const union = (a, b) => {
    const byId = new Map();
    for (const item of [...a.matched, ...b.matched]) byId.set(item.id, item);

    return {
      ids: [...byId.keys()],
      matched: [...byId.values()],
      unmatched: a.unmatched ?? [],
    };
  };

  const locations = union(named, scanned);
  const amenities = union(namedAmenities, scannedAmenities);

  const resolvedFilters = {
    ...filters,
    locations: locations.ids,
    amenities: amenities.ids,
    page: req.body?.page ?? req.query?.page,
    limit: req.body?.limit ?? req.query?.limit,
    sort: req.body?.sort ?? req.query?.sort,
  };
  delete resolvedFilters.location;

  // --- 5 & 6. Run it through the ordinary query engine -------------------------
  const relaxed = [];
  let current = { ...resolvedFilters };
  let properties = [];
  let total = 0;
  let applied = {};
  let page = 1;
  let limit = 12;

  for (let step = 0; step <= 3; step += 1) {
    const built = buildPropertyQuery(current);

    [properties, total] = await Promise.all([
      Property.find(built.query)
        .populate(PUBLIC_POPULATE)
        .sort(built.sort)
        .skip(built.skip)
        .limit(built.limit)
        .lean(),
      Property.countDocuments(built.query),
    ]);

    /**
     * Chips always show the visitor's own request, never the relaxed version.
     *
     * If a search for "under ₦200m" is widened to ₦220m to find anything, a chip
     * reading "Under ₦220m" claims the visitor asked for something they didn't.
     * What was widened is reported separately in `relaxed` (§5.5), which is the
     * honest way to say it.
     */
    if (step === 0) applied = built.applied;

    page = built.page;
    limit = built.limit;

    if (total > 0 || step === 3) break;

    // §5.5 — relax in a defined order and say plainly what was widened. The state
    // of the requested areas is passed so widening stays geographically sensible.
    const next = relaxFilters(current, step, { state: locations.matched[0]?.state });
    if (!next) continue;

    current = next.filters;
    relaxed.push(next.relaxed);
  }

  // --- 7. Log for the demand report (§5.7) -------------------------------------
  // No personal data, by design — see searchLogModel.
  SearchLog.create({
    rawQuery: String(rawQuery),
    normalizedQuery: normalized,
    filters: applied,
    source: "ai",
    cacheHit,
    resultCount: total,
    relaxedConstraints: relaxed,
    parseDurationMs: Date.now() - startedAt,
  }).catch((error) => logger.warn(`Failed to log search: ${error.message}`));

  res.status(200).json({
    success: true,
    data: {
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      /**
       * The interpreted filters, rendered by the front end as removable chips
       * (§5.2 step 7) — "Apartment · 3+ beds · Lekki · Under ₦100m". The visitor
       * sees how their phrase was read and can correct it.
       */
      applied: {
        ...applied,
        locations: locations.matched,
        amenities: amenities.matched,
      },
      relaxed,
      // So the UI can say "we don't cover Yenagoa" rather than silently ignoring it.
      unmatched: [...locations.unmatched, ...amenities.unmatched],
      // Transparency about how the phrase was handled; also lets the front end
      // decide whether to nudge the visitor toward the filter panel instead.
      interpretation: { parsedBy, cacheHit },
    },
  });
}

import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";
import Location from "../model/locationModel.js";
import ApiError from "../utils/ApiError.js";
import { canManageProperty } from "../middleware/auth.js";
import { buildSearchRegex } from "../utils/escapeRegex.js";
import { propertySlug } from "../utils/slugify.js";
import { LISTING_STATUSES, PUBLICATION_STATES } from "../utils/constants.js";

/**
 * Admin listing management (§4.2).
 *
 * Two rules run through everything here:
 *  - §7 permissions: an administrator manages all listings, an agent only their own.
 *  - Publishing is gated by the agent's canPublish flag, because whether agents
 *    publish directly or need administrator approval is a client decision.
 */

/** Fields a client may set. Anything else in the body is ignored, so a crafted
 *  request cannot write viewCount, publishedAt, deletedAt or reassign ownership. */
const WRITABLE_FIELDS = [
  "title",
  "description",
  "listingType",
  "propertyType",
  "location",
  "state",
  "landmark",
  "address",
  "coordinates",
  "bedrooms",
  "bathrooms",
  "toilets",
  "boysQuarters",
  "parkingSpaces",
  "landSizeSqm",
  "builtAreaSqm",
  "yearBuilt",
  "price",
  "rent",
  "landTitle",
  "infrastructure",
  "tags",
  "coverImage",
  "floorPlan",
  "metaTitle",
  "metaDescription",
  "ogImage",
];

/**
 * Copies only permitted fields from a request body.
 *
 * Takes: body (object).
 * Returns: an object containing just the writable fields that were present.
 */
function pickWritable(body = {}) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );
}

/**
 * Generates the next listing reference, e.g. "REF1043".
 *
 * Takes: nothing.
 * Returns: a promise resolving to the reference string.
 *
 * Derived from the highest existing numeric reference rather than a count, so
 * deleting a listing can never cause a collision with a reused number.
 */
async function nextReference() {
  const latest = await Property.findOne({ reference: /^REF\d+$/ })
    .sort({ reference: -1 })
    .select("reference")
    .lean();

  const current = latest ? Number(latest.reference.replace("REF", "")) : 1000;
  return `REF${current + 1}`;
}

/**
 * Loads a listing and checks the caller may act on it.
 *
 * Takes: id (string), user (req.user).
 * Returns: a promise resolving to the Property document.
 * Throws: ApiError 404 when missing, 403 when the caller doesn't own it.
 */
async function loadManageable(id, user) {
  const property = await Property.findById(id);

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  if (!canManageProperty(user, property)) {
    throw new ApiError(403, "You can only manage your own listings");
  }

  return property;
}

/**
 * Resolves the state from the chosen location.
 *
 * State is denormalised onto the property (it drives the Lagos rent-rule check), so
 * it must never be taken from the request body — a client could otherwise send
 * state:"Ogun" on a Lagos listing and bypass the statutory fee cap.
 *
 * Takes: locationId (string).
 * Returns: a promise resolving to the state name.
 * Throws: ApiError 400 when the location doesn't exist.
 */
async function resolveState(locationId) {
  const location = await Location.findById(locationId).select("state").lean();

  if (!location) {
    throw new ApiError(400, "Location not found");
  }

  return location.state;
}

/**
 * GET /api/admin/properties — the admin listing table.
 *
 * Unlike the public search this returns drafts and soft-deleted records, scoped to
 * what the caller may see.
 *
 * Takes: (req, res); query: status, publicationState, q, includeDeleted, page, limit.
 * Returns: nothing; sends { success, data: { properties, pagination } }.
 */
export async function listAdminProperties(req, res) {
  const query = {};

  // Agents only ever see their own listings, enforced server-side rather than by
  // the admin UI omitting a filter.
  if (req.user.role !== "administrator") {
    query.agent = req.user._id;
  }

  if (LISTING_STATUSES.includes(req.query.status)) query.status = req.query.status;
  if (PUBLICATION_STATES.includes(req.query.publicationState)) {
    query.publicationState = req.query.publicationState;
  }

  // Soft-deleted listings are hidden unless explicitly requested, so the default
  // table view matches what the public sees.
  if (req.query.includeDeleted !== "true") query.deletedAt = null;

  if (req.query.q) {
    const term = String(req.query.q).trim();
    // Reference or title substring — what staff actually search the table by.
    const pattern = buildSearchRegex(term);
    query.$or = [{ reference: pattern }, { title: pattern }];
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const [properties, total] = await Promise.all([
    Property.find(query)
      .populate([
        { path: "location", select: "name slug state" },
        { path: "agent", select: "name slug" },
        { path: "coverImage", select: "url thumbnailUrl alt" },
      ])
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Property.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

/**
 * GET /api/admin/properties/:id — one listing, for the editor.
 *
 * Separate from the public detail endpoint because that one is slug-based and applies
 * the published scope; the editor works on drafts and soft-deleted records by id.
 *
 * Returns the gallery alongside the listing so the cover-image picker has something to
 * render without a second round trip. `documents` stays unselected (select:false on the
 * model) — it isn't writable and this screen doesn't edit it.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: { property, media } }.
 * Throws: ApiError 404 when missing, 403 when it belongs to another agent.
 */
export async function getAdminProperty(req, res) {
  const property = await loadManageable(req.params.id, req.user);

  // Populated after the ownership check, so an unauthorised caller never triggers
  // the extra reads.
  await property.populate([
    { path: "location", select: "name slug state" },
    { path: "agent", select: "name slug" },
    { path: "tags", select: "key name category" },
    { path: "coverImage", select: "url thumbnailUrl alt" },
  ]);

  const media = await PropertyMedia.find({ property: property._id })
    .sort({ displayOrder: 1 })
    .lean();

  res.status(200).json({ success: true, data: { property, media } });
}

/**
 * POST /api/admin/properties — create a listing.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends 201 with { success, data: { property } }.
 * Throws: ApiError 400 on invalid input, 403 when an agent tries to publish without
 *         permission.
 */
export async function createProperty(req, res) {
  const data = pickWritable(req.body);

  if (!data.location) {
    throw new ApiError(400, "Location is required");
  }

  data.state = await resolveState(data.location);
  data.reference = await nextReference();
  data.slug = propertySlug(data.title ?? "listing", data.reference);

  /**
   * Ownership is assigned, never accepted from the request.
   *
   * An administrator may create on another agent's behalf; an agent always owns
   * what they create, so they can't file a listing under someone else's name.
   */
  data.agent =
    req.user.role === "administrator" && req.body.agent ? req.body.agent : req.user._id;

  // §7 — publishing rights are per-agent and a client decision. An agent without
  // them can create, but the listing waits in draft for administrator approval.
  const wantsPublish = req.body.publicationState === "published";
  if (wantsPublish && req.user.role !== "administrator" && !req.user.canPublish) {
    throw new ApiError(403, "You do not have permission to publish listings directly");
  }
  data.publicationState = wantsPublish ? "published" : "draft";

  const property = await Property.create(data);

  res.status(201).json({ success: true, data: { property } });
}

/**
 * PATCH /api/admin/properties/:id — update a listing.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: { property } }.
 * Throws: ApiError 403/404 per loadManageable, 403 on unauthorised publishing.
 */
export async function updateProperty(req, res) {
  const property = await loadManageable(req.params.id, req.user);
  const data = pickWritable(req.body);

  // Moving a listing to a different area must move its state with it, or the
  // rent-rule validation would run against the old one.
  if (data.location && String(data.location) !== String(property.location)) {
    data.state = await resolveState(data.location);
  }

  // Keep the slug in step with a retitled listing, but preserve the reference so the
  // URL stays recognisably the same record.
  if (data.title && data.title !== property.title) {
    data.slug = propertySlug(data.title, property.reference);
  }

  if (req.body.publicationState) {
    const wantsPublish = req.body.publicationState === "published";

    if (wantsPublish && req.user.role !== "administrator" && !req.user.canPublish) {
      throw new ApiError(403, "You do not have permission to publish listings directly");
    }

    if (PUBLICATION_STATES.includes(req.body.publicationState)) {
      property.publicationState = req.body.publicationState;
    }
  }

  if (LISTING_STATUSES.includes(req.body.status)) {
    property.status = req.body.status;
  }

  // Assign through set() so schema validators and the publishedAt hook still run —
  // findByIdAndUpdate would skip both.
  property.set(data);
  await property.save();

  res.status(200).json({ success: true, data: { property } });
}

/**
 * DELETE /api/admin/properties/:id — soft delete (§4.2).
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: null }.
 */
export async function softDeleteProperty(req, res) {
  const property = await loadManageable(req.params.id, req.user);

  // Soft, never hard: enquiries and viewings reference this listing, and a hard
  // delete would orphan the agency's own lead history.
  property.deletedAt = new Date();
  property.publicationState = "draft";
  await property.save();

  res.status(200).json({ success: true, data: null });
}

/**
 * POST /api/admin/properties/:id/restore — undo a soft delete.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends { success, data: { property } }.
 */
export async function restoreProperty(req, res) {
  const property = await loadManageable(req.params.id, req.user);

  property.deletedAt = null;
  await property.save();

  res.status(200).json({ success: true, data: { property } });
}

/**
 * POST /api/admin/properties/:id/feature — toggle homepage placement (§4.2).
 *
 * Administrator-only: featuring is an editorial decision about the homepage, not
 * something an agent should be able to award their own listing.
 *
 * Takes: (req, res) — Express handler; body { isFeatured }.
 * Returns: nothing; sends { success, data: { property } }.
 */
export async function featureProperty(req, res) {
  const property = await Property.findById(req.params.id);

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  // An admin toggle, explicitly not a paid boost (§4.2).
  property.isFeatured = req.body.isFeatured !== false;
  await property.save();

  res.status(200).json({ success: true, data: { property } });
}

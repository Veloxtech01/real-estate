import mongoose from "mongoose";

import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { canManageProperty } from "../middleware/auth.js";
import { configureCloudinary } from "../config/cloudinary.js";
import { buildUploadSignature, isInListingFolder } from "../utils/mediaSignature.js";

/**
 * Listing gallery management (§4.2).
 *
 * The browser uploads straight to Cloudinary under a signature this controller
 * issues, so the API never sees the image bytes. That makes the registration step the
 * security hinge of the whole feature: the client sends a public_id and nothing else,
 * and every stored field is read back from Cloudinary rather than believed.
 */

/**
 * Fetches a listing and asserts the caller may manage it.
 *
 * Mirrors loadManageable() in adminPropertyController.js — same §7 rule, and 403
 * rather than 404 on an ownership violation because these are authenticated
 * colleagues, not the public.
 *
 * Soft-deleted listings are still manageable: their media must not become
 * unreachable while the listing is restorable.
 *
 * Takes: id (string), user (req.user).
 * Returns: a promise resolving to the Property document.
 * Throws: ApiError 404 when missing or the id is malformed, 403 when not permitted.
 */
async function loadManageableProperty(id, user) {
  // Checked explicitly so a malformed id 404s like a missing one. Letting Mongoose
  // throw a CastError would surface as a 400 and read as a validation failure.
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, "Property not found");
  }

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
 * Loads one image, scoped to its listing.
 *
 * Scoping the query by property is what makes another listing's mediaId a 404 rather
 * than an edit — the id alone is not authorisation.
 *
 * Takes: mediaId (string), propertyId (ObjectId).
 * Returns: a promise resolving to the PropertyMedia document.
 * Throws: ApiError 404 when it does not belong to this listing.
 */
async function loadListingMedia(mediaId, propertyId) {
  if (!mongoose.isValidObjectId(mediaId)) {
    throw new ApiError(404, "Image not found");
  }

  const media = await PropertyMedia.findOne({ _id: mediaId, property: propertyId });

  if (!media) {
    throw new ApiError(404, "Image not found");
  }

  return media;
}

/**
 * POST /api/admin/properties/:id/media/signature — authorise one direct upload.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends 200 with { success, data: { ...signature } }.
 * Throws: ApiError 404/403 via loadManageableProperty, 503 when Cloudinary is
 *         unconfigured.
 */
export async function createUploadSignature(req, res) {
  const property = await loadManageableProperty(req.params.id, req.user);

  res.status(200).json({
    success: true,
    data: buildUploadSignature(property.reference),
  });
}

/**
 * POST /api/admin/properties/:id/media — register an asset the browser uploaded.
 *
 * The order of the checks below is deliberate and load-bearing; see the inline notes.
 *
 * Takes: (req, res) — Express handler; body carries { publicId, alt? } only.
 * Returns: nothing; sends 201 with { success, data: { media } }.
 * Throws: ApiError 400 for a foreign or missing publicId, 404 when Cloudinary has no
 *         such asset, 502 when Cloudinary cannot be reached.
 */
export async function registerMedia(req, res) {
  const property = await loadManageableProperty(req.params.id, req.user);
  const { publicId, alt } = req.body ?? {};

  if (typeof publicId !== "string" || publicId.trim().length === 0) {
    throw new ApiError(400, "publicId is required");
  }

  // Before any Cloudinary call, on purpose: verifying first would turn this endpoint
  // into an oracle for which public ids exist in the account.
  if (!isInListingFolder(publicId, property.reference)) {
    throw new ApiError(400, "That image does not belong to this listing");
  }

  const cloudinary = configureCloudinary();
  let resource;

  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: "image" });
  } catch (error) {
    if (error?.http_code === 404 || error?.error?.http_code === 404) {
      throw new ApiError(404, "That image was not found");
    }

    // Never surface the raw SDK error: it carries account and request detail.
    logger.error(`Cloudinary lookup failed for ${publicId}: ${error?.message}`);
    throw new ApiError(502, "Could not verify the upload with Cloudinary");
  }

  // New images go to the end of the gallery. Computed here rather than accepted from
  // the body, so a client cannot reorder by uploading.
  const last = await PropertyMedia.findOne({ property: property._id })
    .sort({ displayOrder: -1 })
    .select("displayOrder")
    .lean();

  const media = await PropertyMedia.create({
    property: property._id,
    publicId: resource.public_id,
    // Every one of these comes from Cloudinary's response, never the request body.
    // A client-supplied url would make the record point anywhere, and client-supplied
    // dimensions would poison the layout-space reservation on every page the image
    // appears on.
    url: resource.secure_url,
    thumbnailUrl: resource.eager?.[0]?.secure_url ?? resource.secure_url,
    width: resource.width,
    height: resource.height,
    bytes: resource.bytes,
    type: "image",
    // The only body field honoured besides publicId.
    alt: typeof alt === "string" ? alt.trim() : undefined,
    displayOrder: last ? last.displayOrder + 1 : 0,
  });

  res.status(201).json({ success: true, data: { media } });
}

/**
 * PATCH /api/admin/properties/:id/media/order — reorder the gallery.
 *
 * Takes: (req, res) — Express handler; body { ids: string[] }.
 * Returns: nothing; sends 200 with { success, data: { media } } in the new order.
 * Throws: ApiError 400 when ids is not a full permutation of this listing's media.
 */
export async function reorderMedia(req, res) {
  const property = await loadManageableProperty(req.params.id, req.user);
  const { ids } = req.body ?? {};

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw new ApiError(400, "ids must be an array of media ids");
  }

  const existing = await PropertyMedia.find({ property: property._id })
    .select("_id")
    .lean();

  const known = new Set(existing.map((item) => String(item._id)));
  const submitted = new Set(ids);

  // A full permutation is required, not a subset. A partial list would leave the
  // omitted rows holding stale displayOrder values that collide with the rewritten
  // ones, and the gallery order becomes arbitrary rather than wrong-but-fixable.
  if (
    submitted.size !== ids.length ||
    ids.length !== known.size ||
    ids.some((id) => !known.has(id))
  ) {
    throw new ApiError(400, "ids must list every image in this listing exactly once");
  }

  await PropertyMedia.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index } } },
    }))
  );

  // Reloaded rather than echoed back, so the client renders the server's truth.
  const media = await PropertyMedia.find({ property: property._id })
    .sort({ displayOrder: 1 })
    .lean();

  res.status(200).json({ success: true, data: { media } });
}

/**
 * PATCH /api/admin/properties/:id/media/:mediaId — edit an image's alt text.
 *
 * Takes: (req, res) — Express handler; body { alt }.
 * Returns: nothing; sends 200 with { success, data: { media } }.
 * Throws: ApiError 404 when the image is not on this listing.
 */
export async function updateMedia(req, res) {
  const property = await loadManageableProperty(req.params.id, req.user);
  const media = await loadListingMedia(req.params.mediaId, property._id);

  // Assigned explicitly rather than spreading the body: url, publicId, displayOrder
  // and the dimensions are all server-controlled, the same discipline WRITABLE_FIELDS
  // enforces in adminPropertyController.js. Empty string is a valid clear.
  if (typeof req.body?.alt === "string") {
    media.alt = req.body.alt.trim();
  }

  await media.save();

  res.status(200).json({ success: true, data: { media } });
}

/**
 * DELETE /api/admin/properties/:id/media/:mediaId — remove an image for good.
 *
 * Unlike a listing's soft delete, this is permanent: the Cloudinary asset is
 * destroyed and there is nothing to restore.
 *
 * Takes: (req, res) — Express handler.
 * Returns: nothing; sends 200 with { success, data: { deleted: true } }.
 * Throws: ApiError 404 when the image is not on this listing, 502 when Cloudinary
 *         could not be reached.
 */
export async function deleteMedia(req, res) {
  const property = await loadManageableProperty(req.params.id, req.user);
  const media = await loadListingMedia(req.params.mediaId, property._id);

  const cloudinary = configureCloudinary();

  // Cloudinary first, database second. An orphaned Cloudinary asset bills forever
  // with nothing pointing at it; an orphaned database row is visible and fixable.
  try {
    const result = await cloudinary.uploader.destroy(media.publicId, {
      resource_type: "image",
      // Purges the CDN cache. Without it the deleted photo keeps being served from
      // edge nodes long after the record is gone.
      invalidate: true,
    });

    // "not found" is the outcome we wanted. Failing here would make a half-deleted
    // image permanently undeletable from the UI.
    if (result?.result && result.result !== "ok" && result.result !== "not found") {
      throw new Error(result.result);
    }
  } catch (error) {
    logger.error(`Cloudinary delete failed for ${media.publicId}: ${error?.message}`);
    throw new ApiError(502, "Could not delete the image from Cloudinary");
  }

  await media.deleteOne();

  // Scoped to the cover still being this image, so a concurrent cover change made
  // between the read and the write is not clobbered. A dangling coverImage would
  // make coverImageOf fall through to the grey placeholder with nothing explaining
  // why.
  await Property.updateOne(
    { _id: property._id, coverImage: media._id },
    { $unset: { coverImage: "" } }
  );

  // Remaining displayOrder values are deliberately not renumbered: they stay
  // strictly increasing, which is all the sort needs, and renumbering would race
  // with a concurrent reorder.
  res.status(200).json({ success: true, data: { deleted: true } });
}

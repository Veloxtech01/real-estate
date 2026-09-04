"use client";

import apiClient from "@/lib/api/client";

/**
 * Typed wrappers for the admin API.
 *
 * The only place admin URLs are written. Screens import these rather than building a
 * path inline, so a route change is a one-file edit and no component has to know the
 * `{ success, data }` envelope — every wrapper returns the unwrapped `data`.
 */

/** Sign in. Sets the httpOnly cookie; the token never reaches JS. */
export async function login(credentials) {
  const { data } = await apiClient.post("/auth/login", credentials);
  return data.data;
}

/** Sign out. Clears the cookie server-side. */
export async function logout() {
  await apiClient.post("/auth/logout");
}

/** Restore the session on reload. 401 when signed out. */
export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data.data;
}

/**
 * The editor's vocabulary: every enum, the statutory rent table, land-unit factors,
 * and (administrators only) the staff roster. Fetched once per editor mount.
 */
export async function getAdminReference() {
  const { data } = await apiClient.get("/admin/reference");
  return data.data;
}

/** The listing table. Includes drafts, and soft-deleted rows when asked. */
export async function getProperties(params = {}) {
  const { data } = await apiClient.get("/admin/properties", { params });
  return data.data;
}

/** One listing plus its media gallery, for the editor. */
export async function getProperty(id) {
  const { data } = await apiClient.get(`/admin/properties/${id}`);
  return data.data;
}

/** Create. The server assigns the reference, slug, state and ownership. */
export async function createProperty(body) {
  const { data } = await apiClient.post("/admin/properties", body);
  return data.data.property;
}

/** Update in place. */
export async function updateProperty(id, body) {
  const { data } = await apiClient.patch(`/admin/properties/${id}`, body);
  return data.data.property;
}

/** Soft delete — unlike a lead, this is reversible via restoreProperty. */
export async function deleteProperty(id) {
  await apiClient.delete(`/admin/properties/${id}`);
}

/** Undo a soft delete. */
export async function restoreProperty(id) {
  const { data } = await apiClient.post(`/admin/properties/${id}/restore`);
  return data.data.property;
}

/** Toggle homepage placement. Administrator only; the API 403s for anyone else. */
export async function featureProperty(id, isFeatured) {
  const { data } = await apiClient.post(`/admin/properties/${id}/feature`, { isFeatured });
  return data.data.property;
}

/** The enquiry inbox. `params` is the filter object; axios serialises arrays. */
export async function getEnquiries(params = {}) {
  const { data } = await apiClient.get("/admin/enquiries", { params });
  return data.data;
}

/** Counts by status, scoped to the caller. */
export async function getEnquiryStats() {
  const { data } = await apiClient.get("/admin/enquiries/stats");
  return data.data;
}

/** One lead, including internal notes. */
export async function getEnquiry(id) {
  const { data } = await apiClient.get(`/admin/enquiries/${id}`);
  return data.data;
}

/** Update status, notes, or (administrators only) the assigned agent. */
export async function updateEnquiry(id, body) {
  const { data } = await apiClient.patch(`/admin/enquiries/${id}`, body);
  return data.data;
}

/** Permanent, administrator-only deletion. Returns 204 with no body. */
export async function deleteEnquiry(id) {
  await apiClient.delete(`/admin/enquiries/${id}`);
}

/** The viewing diary. */
export async function getViewings(params = {}) {
  const { data } = await apiClient.get("/admin/viewings", { params });
  return data.data;
}

/** One viewing, including internal notes. */
export async function getViewing(id) {
  const { data } = await apiClient.get(`/admin/viewings/${id}`);
  return data.data;
}

/** Drive the status machine, and set scheduledFor / responseMessage / notes. */
export async function updateViewing(id, body) {
  const { data } = await apiClient.patch(`/admin/viewings/${id}`, body);
  return data.data;
}

/** Permanent, administrator-only deletion. Returns 204 with no body. */
export async function deleteViewing(id) {
  await apiClient.delete(`/admin/viewings/${id}`);
}

/**
 * Authorise one direct-to-Cloudinary upload for a listing.
 *
 * Rate-limited server-side (every call authorises spend), so lib/uploadMedia.js
 * validates the file before asking for one.
 */
export async function createUploadSignature(propertyId) {
  const { data } = await apiClient.post(
    `/admin/properties/${propertyId}/media/signature`,
  );
  return data.data;
}

/**
 * Attach an already-uploaded Cloudinary asset to a listing.
 *
 * `body` carries `publicId` and optionally `alt` — nothing else is honoured. The API
 * re-reads url, dimensions and byte count from Cloudinary rather than trusting us.
 */
export async function registerMedia(propertyId, body) {
  const { data } = await apiClient.post(`/admin/properties/${propertyId}/media`, body);
  return data.data.media;
}

/** Rewrite gallery order. `ids` must list every image in the listing exactly once. */
export async function reorderMedia(propertyId, ids) {
  const { data } = await apiClient.patch(
    `/admin/properties/${propertyId}/media/order`,
    { ids },
  );
  return data.data.media;
}

/** Edit an image's alt text. No other field is writable. */
export async function updateMedia(propertyId, mediaId, body) {
  const { data } = await apiClient.patch(
    `/admin/properties/${propertyId}/media/${mediaId}`,
    body,
  );
  return data.data.media;
}

/** Permanent — destroys the Cloudinary asset too, unlike a listing's soft delete. */
export async function deleteMedia(propertyId, mediaId) {
  await apiClient.delete(`/admin/properties/${propertyId}/media/${mediaId}`);
}

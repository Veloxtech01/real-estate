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

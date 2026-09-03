"use client";

import axios from "axios";

/**
 * The single shared Axios instance for browser-side requests (CLAUDE.md: never call
 * bare axios.get at a call site).
 *
 * Scope in this build is deliberately narrow: **writes only** — enquiry submission and
 * viewing requests. All reads happen server-side in lib/api/server.js so pages render
 * on the server for SEO.
 */
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api",
  // Auth is an httpOnly cookie (`re_token`), so credentials must ride along. Set here
  // once rather than per call — the admin panel slice depends on it too.
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/**
 * Normalise every failure into one Error shape so no call site parses the envelope.
 * `details` is the API's field-level validation map, which react-hook-form maps
 * straight onto inputs via setError.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error.response?.data;
    const status = error.response?.status;

    // 429 comes from the strict rate limiter on lead endpoints. A raw error here reads
    // as a broken form; the friendly wording is decided once, here.
    const fallback =
      status === 429
        ? "Too many requests just now — please wait a minute and try again."
        : "Something went wrong. Please try again.";

    const normalised = new Error(payload?.message || fallback);
    normalised.status = status;
    normalised.details = payload?.details ?? null;
    return Promise.reject(normalised);
  },
);

/**
 * Submit a lead. The backend responds before sending email, so this resolves fast even
 * when the mail provider is slow.
 *
 * @param {object} payload - name, phone required; property, type, source,
 *   consentGiven, marketingOptIn optional.
 */
export async function submitEnquiry(payload) {
  const { data } = await apiClient.post("/enquiries", payload);
  return data.data.enquiry;
}

/** Request a viewing. `requestedFor` must be a future ISO datetime. */
export async function submitViewing(payload) {
  const { data } = await apiClient.post("/viewings", payload);
  return data.data.viewing;
}

export default apiClient;

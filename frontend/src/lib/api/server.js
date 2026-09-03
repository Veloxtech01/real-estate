import { toQueryString } from "@/lib/searchParams";

/**
 * Server-side data layer. Used only from Server Components.
 *
 * Uses `fetch` rather than the shared Axios instance because Next's caching is built
 * on `fetch` — Axios bypasses it entirely. In Next 16 fetch is NOT cached by default,
 * so every read here opts in explicitly via `next.revalidate`.
 *
 * The `{ success, data }` envelope is unwrapped in exactly one place: `request()`.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";

/**
 * Perform one API read.
 *
 * @param {string} path      Path under /api, e.g. "/properties".
 * @param {object} options
 * @param {number} options.revalidate  Seconds to cache the response.
 * @param {string[]} options.tags      Cache tags for targeted revalidation later.
 * @param {object}  options.body       Present for POST reads (natural-language search).
 * @returns {Promise<object|null>} The unwrapped `data`, or null on 404.
 */
async function request(path, { revalidate = 60, tags = [], body } = {}) {
  const isPost = body !== undefined;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: isPost ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: isPost ? JSON.stringify(body) : undefined,
    // A POST is never cached — it is a search submission, not a stable resource.
    ...(isPost ? { cache: "no-store" } : { next: { revalidate, tags } }),
  });

  // 404 is a legitimate answer ("no such listing"), not an error condition. The caller
  // turns it into notFound(). Drafts and soft-deleted listings arrive here too, and
  // must be indistinguishable from a slug that never existed.
  if (response.status === 404) return null;

  if (!response.ok) {
    // Surface the API's own message when it sent one; the error boundary renders a
    // friendly page regardless.
    let message = `API request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
    } catch {
      // Non-JSON error body (proxy error, backend down). Keep the status message.
    }
    throw new Error(message);
  }

  const payload = await response.json();
  return payload.data;
}

/** Search listings. `filters` is the object produced by parseSearchParams. */
export function getProperties(filters = {}) {
  const query = toQueryString(filters);
  return request(`/properties${query ? `?${query}` : ""}`, {
    revalidate: 60,
    tags: ["properties"],
  });
}

/** One listing by slug, with gallery and similar listings. Null when not found. */
export function getProperty(slug) {
  return request(`/properties/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    tags: ["properties", `property:${slug}`],
  });
}

/** Homepage featured rail. Backend caps `limit` at 12. */
export function getFeatured(limit = 6) {
  return request(`/properties/featured?limit=${limit}`, {
    revalidate: 300,
    tags: ["properties", "featured"],
  });
}

/** Everything the filter panel needs, including live price bounds. */
export function getFilters() {
  return request("/filters", { revalidate: 3600, tags: ["filters"] });
}

/** Published areas. Pass `{ state, published }` to narrow. */
export function getLocations(params = {}) {
  const query = toQueryString(params);
  return request(`/locations${query ? `?${query}` : ""}`, {
    revalidate: 3600,
    tags: ["locations"],
  });
}

/** One area, with its available listing count. */
export function getLocation(slug) {
  return request(`/locations/${encodeURIComponent(slug)}`, {
    revalidate: 3600,
    tags: ["locations", `location:${slug}`],
  });
}

/**
 * Public site settings. Only used for `listingDisclaimer` in this build — all other
 * chrome is local config (spec §1). Cached hard: it changes rarely.
 */
export function getSettings() {
  return request("/settings", { revalidate: 3600, tags: ["settings"] });
}

/**
 * Natural-language search. Returns the same shape as getProperties plus
 * `interpretation`. Works with AI disabled — the backend's deterministic parser
 * handles prices, "to let", property types and place names on its own.
 */
export function naturalSearch({ q, page = 1, limit = 12, sort = "newest" }) {
  return request("/search", { body: { q, page, limit, sort } });
}

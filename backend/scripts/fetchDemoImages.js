import "dotenv/config";

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import logger from "../utils/logger.js";

/**
 * Regenerates the demo image catalogue at scripts/demoImages.js.
 *
 * Run by hand — `node scripts/fetchDemoImages.js` — and never imported by the seed.
 * Seeding runs inside tests and against live clusters, so it must stay offline and
 * deterministic; a rate-limited third-party call in that path would make it flaky.
 *
 * Needs PEXELS_API_KEY (free, instant, no card: https://www.pexels.com/api/).
 *
 * Pexels does answer some unauthenticated requests, which is misleading — the keyless
 * quota is a handful of requests and then every call 401s for minutes, so a sixteen
 * query run cannot complete without a key. The key is a generator-time credential
 * only: it never reaches the running API, the seed, or the browser.
 *
 * Photos are licensed for free commercial use without attribution, though the source
 * is credited in frontend/public/CREDITS.md anyway.
 */

/**
 * Search terms per catalogue category.
 *
 * Several queries per category rather than one, because a single query returns
 * near-identical framings and a gallery built from them looks like a mistake.
 */
const QUERIES = {
  exterior: ["modern house exterior", "luxury home exterior", "duplex house", "villa house"],
  // "bathroom interior" alone returns public restrooms, which look absurd on a
  // luxury duplex; "luxury home bathroom" keeps it domestic.
  interior: ["living room interior", "modern kitchen", "bedroom interior", "luxury home bathroom"],
  land: ["empty land plot", "vacant lot", "land for sale", "cleared field"],
  commercial: ["office building", "retail shop front", "warehouse interior", "office space"],
};

/**
 * Delay between search-API requests.
 *
 * An authenticated key allows 200 requests an hour, far more than this run needs, but
 * a small pause keeps us clearly inside it. Only api.pexels.com needs this: the CDN
 * (images.pexels.com) is a different host and serves verification requests freely, so
 * pacing those too would turn a one-minute run into a ten-minute one for nothing.
 */
const PACE_MS = 400;

/** Photos kept per category below this count means the catalogue would repeat. */
const MIN_PER_CATEGORY = 12;

/** Pexels sizing params. Verified to deliver exactly these pixel dimensions. */
const FULL_PARAMS = "auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop";
const THUMB_PARAMS = "auto=compress&cs=tinysrgb&w=400&h=300&fit=crop";

/** The dimensions FULL_PARAMS actually delivers — stored so layout can reserve space. */
const FULL_WIDTH = 1200;
const FULL_HEIGHT = 800;

/**
 * Pauses execution.
 *
 * Takes: ms (number).
 * Returns: a promise resolving after the delay.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches with exponential backoff on a throttled response.
 *
 * Keyless Pexels access is rate-limited hard enough that roughly every other request
 * comes back 401 with no `Retry-After` — it is throttling, not an auth failure, and
 * the identical URL succeeds moments later. Nothing here is time-critical (this is a
 * hand-run generator), so waiting is the correct answer. This is also precisely why
 * the catalogue is committed rather than fetched at seed time.
 *
 * Takes: url (string), init (object) — fetch options; attempts (number);
 *        pace (number) — ms to wait before each attempt, 0 for unthrottled hosts.
 * Returns: a promise resolving to the Response, or null once attempts run out.
 */
async function fetchWithRetry(url, init = {}, attempts = 7, pace = PACE_MS) {
  let lastReason = "unknown";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Paced from the first attempt, not just on retry: bursting is what earns the
    // throttle in the first place, and a hand-run generator can afford to be slow.
    if (pace > 0) await sleep(pace);

    try {
      const response = await fetch(url, init);

      // 429 is the documented throttle; 401 is what keyless access actually returns.
      if (response.status !== 401 && response.status !== 429) return response;
      lastReason = `HTTP ${response.status}`;
    } catch (error) {
      // Surfaced rather than swallowed — "network error" with no cause hid a
      // temporary IP-level block during development and cost an hour.
      lastReason = error.cause?.message ?? error.message;
    }

    await sleep(Math.max(pace, 300) * 2 ** attempt);
  }

  logger.warn(`  ! gave up on ${url} — ${lastReason}`);
  return null;
}

/**
 * Runs one Pexels search.
 *
 * Takes: query (string) — the search phrase.
 * Returns: a promise resolving to the raw `photos` array, or [] when the request
 *          fails. A single failed query should thin the catalogue, not abort the run.
 */
async function search(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query
  )}&per_page=8&orientation=landscape`;

  const response = await fetchWithRetry(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY },
  });

  if (!response?.ok) {
    logger.warn(`  ! "${query}" returned nothing usable`);
    return [];
  }

  const body = await response.json();
  return body.photos ?? [];
}

/**
 * Confirms a composed CDN URL actually serves an image.
 *
 * An unverified URL becomes a broken frame in every gallery it lands in, and the
 * seed has no way to notice — so nothing enters the catalogue unchecked.
 *
 * Takes: url (string).
 * Returns: a promise resolving to true when the URL responds 200.
 */
async function isLive(url) {
  // No pacing: this is the CDN, not the throttled search API.
  const response = await fetchWithRetry(url, { method: "HEAD" }, 3, 0);
  return Boolean(response?.ok);
}

/**
 * Collects and verifies the photos for one category.
 *
 * Takes: category (string), queries (string[]).
 * Returns: a promise resolving to the catalogue entries for that category.
 */
async function collect(category, queries) {
  // Keyed by Pexels photo id: the same photo ranks for two queries often enough that
  // duplicates would defeat the no-repeat guarantee in demoGallery.js.
  const seen = new Map();
  let rejected = 0;

  for (const query of queries) {
    const photos = (await search(query)).filter((photo) => !seen.has(photo.id));

    // Verified concurrently: the CDN is not the throttled host, and checking eight
    // URLs in sequence was the single slowest part of the run.
    const checked = await Promise.all(
      photos.map(async (photo) => {
        // `src.original` is a bare images.pexels.com URL, so the sizing params can
        // be appended with "?" rather than merged into an existing query string.
        const url = `${photo.src.original}?${FULL_PARAMS}`;
        return { photo, url, live: await isLive(url) };
      })
    );

    for (const { photo, url, live } of checked) {
      if (!live) {
        rejected += 1;
        continue;
      }

      seen.set(photo.id, {
        url,
        thumbnailUrl: `${photo.src.original}?${THUMB_PARAMS}`,
        width: FULL_WIDTH,
        height: FULL_HEIGHT,
        // Lowercased because demoGallery.js composes it after an em dash into a
        // sentence that already starts with the listing title.
        alt: (photo.alt?.trim() || query).toLowerCase(),
        photographer: photo.photographer,
        sourceUrl: photo.url,
      });
    }

    logger.info(`  ${query}: +${checked.filter((c) => c.live).length}`);
  }

  logger.info(`${category}: kept ${seen.size}, rejected ${rejected}`);
  return [...seen.values()];
}

/**
 * Serialises the catalogue to a committed ESM module.
 *
 * Takes: catalogue (object) — category name to entry array.
 * Returns: a promise resolving once the file is written.
 */
async function write(catalogue) {
  const target = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "demoImages.js"
  );

  const body = `/**
 * Demo listing photography, sourced from Pexels.
 *
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *   node scripts/fetchDemoImages.js
 *
 * Every URL here was verified live at generation time. Selection logic lives in
 * demoGallery.js, not this file, because a regeneration overwrites this one whole.
 *
 * Generated: ${new Date().toISOString().slice(0, 10)}
 */
export const DEMO_IMAGES = ${JSON.stringify(catalogue, null, 2)};
`;

  await writeFile(target, body, "utf8");
  logger.info(`\nWrote ${target}`);
}

/**
 * Entry point: build every category, refuse to write a thin catalogue, then save.
 *
 * Takes: nothing.
 * Returns: a promise resolving once the file is written. Exits non-zero when a
 *          category came up short, rather than silently shipping repeats.
 */
async function main() {
  if (!process.env.PEXELS_API_KEY) {
    logger.error(
      [
        "PEXELS_API_KEY is not set.",
        "Get a free key at https://www.pexels.com/api/ and add it to backend/.env.",
        "It is only used here, when regenerating the catalogue.",
      ].join("\n")
    );
    process.exit(1);
  }

  const catalogue = {};

  for (const [category, queries] of Object.entries(QUERIES)) {
    catalogue[category] = await collect(category, queries);
  }

  const thin = Object.entries(catalogue).filter(
    ([, items]) => items.length < MIN_PER_CATEGORY
  );

  if (thin.length > 0) {
    logger.error(
      `\nToo few photos in: ${thin
        .map(([category, items]) => `${category} (${items.length}/${MIN_PER_CATEGORY})`)
        .join(", ")}\nAdd or broaden the queries and re-run — a thin category repeats.`
    );
    process.exit(1);
  }

  await write(catalogue);
}

await main();

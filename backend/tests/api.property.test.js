import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { connectTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import { importDemoListings } from "../scripts/importDemoListings.js";
import Property from "../model/propertyModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_FILE = path.resolve(__dirname, "../../nigerian_real_estate_dummy_data_200.json");

/**
 * Public API integration tests, run against the seeded demo dataset.
 *
 * Seeded once for the whole file rather than per test: these are read-only endpoints,
 * and importing 200 listings for each case would dominate the runtime.
 */
describe("Public property API", () => {
  const app = createApp();

  beforeAll(async () => {
    await connectTestDB();
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });
    // Text search needs its index built before the first $text query.
    await Property.syncIndexes();
  }, 120000);

  afterAll(closeTestDB);

  it("lists published properties with pagination", async () => {
    const response = await request(app).get("/api/properties");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.properties).toHaveLength(12); // default page size
    expect(response.body.data.pagination.total).toBeGreaterThan(100);
  });

  it("populates the card data the listing grid needs", async () => {
    const response = await request(app).get("/api/properties?limit=1");
    const [property] = response.body.data.properties;

    expect(property.location.name).toBeTruthy();
    expect(property.agent.name).toBeTruthy();
    expect(property.coverImage.url).toBeTruthy();
  });

  it("never exposes drafts, soft-deleted listings or private documents", async () => {
    // Take a listing out of publication and confirm it disappears from the API.
    const property = await Property.findOne({});
    await Property.updateOne({ _id: property._id }, { $set: { publicationState: "draft" } });

    const list = await request(app).get(`/api/properties?q=${encodeURIComponent(property.reference)}`);
    const ids = list.body.data.properties.map((p) => p._id);
    expect(ids).not.toContain(String(property._id));

    // A draft must 404 exactly like a non-existent listing, or the response leaks
    // that the reference exists.
    const detail = await request(app).get(`/api/properties/${property.slug}`);
    expect(detail.status).toBe(404);

    await Property.updateOne({ _id: property._id }, { $set: { publicationState: "published" } });

    const published = await request(app).get(`/api/properties/${property.slug}`);
    expect(published.status).toBe(200);
    expect(published.body.data.property.documents).toBeUndefined();
  });

  it("filters by listing type", async () => {
    const response = await request(app).get("/api/properties?listingType=rent&limit=20");

    expect(response.body.data.properties.length).toBeGreaterThan(0);
    for (const property of response.body.data.properties) {
      expect(property.listingType).toBe("rent");
    }
  });

  it("filters by location using an alias, not just the canonical name", async () => {
    // "vi" is a seeded alias for Victoria Island (§5.4) — the whole point of the
    // alias table is that a visitor never types the canonical form.
    const response = await request(app).get("/api/properties?location=vi&limit=20");

    expect(response.status).toBe(200);
    expect(response.body.data.applied.locations[0].name).toBe("Victoria Island");
    for (const property of response.body.data.properties) {
      expect(property.location.name).toBe("Victoria Island");
    }
  });

  it("filters a sale price range without matching rents", async () => {
    const response = await request(app).get(
      "/api/properties?listingType=sale&priceMax=100000000&limit=48"
    );

    for (const property of response.body.data.properties) {
      expect(property.price.amount).toBeLessThanOrEqual(100000000);
    }
  });

  it("returns the interpreted filters so the UI can render editable chips", async () => {
    const response = await request(app).get(
      "/api/properties?listingType=sale&bedroomsMin=3&location=lekki-phase-1&amenities=pool"
    );

    // §5.2 step 7 — the visitor must be able to see how their request was read.
    const { applied } = response.body.data;
    expect(applied.listingType).toBe("sale");
    expect(applied.bedroomsMin).toBe(3);
    expect(applied.locations[0].slug).toBe("lekki-phase-1-lagos");
    // "pool" is an alias for swimming_pool.
    expect(applied.amenities[0].key).toBe("swimming_pool");
  });

  it("discards unrecognised locations instead of querying on them", async () => {
    const response = await request(app).get("/api/properties?location=atlantis&limit=5");

    expect(response.status).toBe(200);
    // Reported back, so the UI can say what wasn't understood rather than silently
    // returning unrelated results.
    expect(response.body.data.unmatched).toContain("atlantis");
    expect(response.body.data.applied.locations).toHaveLength(0);
  });

  it("relaxes constraints rather than returning an empty page", async () => {
    // A deliberately impossible budget for Ikoyi.
    const response = await request(app).get(
      "/api/properties?location=ikoyi&priceMax=1000&listingType=sale"
    );

    expect(response.status).toBe(200);
    // §5.5: show the closest alternatives and state plainly what was relaxed.
    expect(response.body.data.relaxed.length).toBeGreaterThan(0);
  });

  it("sorts by price ascending and descending", async () => {
    const asc = await request(app).get("/api/properties?listingType=sale&sort=price_asc&limit=10");
    const desc = await request(app).get("/api/properties?listingType=sale&sort=price_desc&limit=10");

    const ascPrices = asc.body.data.properties.map((p) => p.price.amount);
    const descPrices = desc.body.data.properties.map((p) => p.price.amount);

    expect([...ascPrices].sort((a, b) => a - b)).toEqual(ascPrices);
    expect([...descPrices].sort((a, b) => b - a)).toEqual(descPrices);
  });

  it("caps the page size so a crafted request cannot fetch everything", async () => {
    const response = await request(app).get("/api/properties?limit=5000");

    expect(response.body.data.properties.length).toBeLessThanOrEqual(48);
  });

  it("serves a property detail page with gallery and related listings", async () => {
    const list = await request(app).get("/api/properties?limit=1");
    const { slug } = list.body.data.properties[0];

    const response = await request(app).get(`/api/properties/${slug}`);

    expect(response.status).toBe(200);
    expect(response.body.data.gallery).toHaveLength(3);
    expect(Array.isArray(response.body.data.similar)).toBe(true);
  });

  it("404s an unknown slug through the standard error shape", async () => {
    const response = await request(app).get("/api/properties/no-such-property-ref9999");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/not found/i);
  });

  it("serves the featured rail for the homepage", async () => {
    const response = await request(app).get("/api/properties/featured");

    expect(response.status).toBe(200);
    for (const property of response.body.data.properties) {
      expect(property.isFeatured).toBe(true);
    }
  });
});

describe("Reference data API", () => {
  const app = createApp();

  beforeAll(async () => {
    await connectTestDB();
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });
  }, 120000);

  afterAll(closeTestDB);

  it("lists locations for the areas-we-cover pages", async () => {
    const response = await request(app).get("/api/locations");

    expect(response.status).toBe(200);
    expect(response.body.data.locations.length).toBeGreaterThan(0);
  });

  it("returns an area with its available listing count", async () => {
    const response = await request(app).get("/api/locations/lekki-phase-1-lagos");

    expect(response.status).toBe(200);
    expect(response.body.data.location.name).toBe("Lekki Phase 1");
    expect(response.body.data.propertyCount).toBeGreaterThan(0);
  });

  it("404s an unpublished area the same as an unknown slug", async () => {
    // Ajah ships unpublished (no area copy yet) — its landing page must not be
    // browsable before a client (or a direct DB write) supplies real copy, matching
    // the draft/soft-deleted 404 parity every other public resource already has.
    const response = await request(app).get("/api/locations/ajah-lagos");

    expect(response.status).toBe(404);
  });

  it("groups taxonomy by category for the filter panel", async () => {
    const response = await request(app).get("/api/taxonomy");

    expect(response.body.data.taxonomy.amenity.length).toBeGreaterThan(0);
    expect(response.body.data.taxonomy.security.length).toBeGreaterThan(0);
  });

  it("serves filter options with real price bounds from live stock", async () => {
    const response = await request(app).get("/api/filters");

    const { data } = response.body;
    expect(data.propertyTypes).toContain("semi_detached");
    // Separate sale and rent ranges — they differ by orders of magnitude.
    expect(data.priceRange.sale.max).toBeGreaterThan(data.priceRange.rent.max);
  });

  it("exposes public settings but never the AI spend cap", async () => {
    const response = await request(app).get("/api/settings");

    const { settings } = response.body.data;
    expect(settings.agencyName).toBeTruthy();
    expect(settings.theme).toBeTruthy();
    expect(settings.aiSearchEnabled).toBe(false);
    // Operational figures must not reach the browser.
    expect(settings.aiSearch).toBeUndefined();
    expect(settings.googleAnalyticsId).toBeUndefined();
  });
});

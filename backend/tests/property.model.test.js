import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import Property from "../model/propertyModel.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";

/**
 * Property model tests.
 *
 * These focus on the Nigerian-market rules from scope doc §8.2 — the fields where a
 * generic international listing schema would be wrong, and where being wrong has
 * legal or commercial consequences rather than merely cosmetic ones.
 */
describe("Property model", () => {
  let agent;
  let location;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  /**
   * Builds a valid baseline listing, so each test can override just the one field
   * it is actually about.
   *
   * Takes: overrides (object) — partial property fields.
   * Returns: a plain object suitable for Property.create().
   */
  async function buildProperty(overrides = {}) {
    // Referenced documents are recreated per test because clearTestDB empties them.
    agent = await Agent.create({
      name: "Test Agent",
      slug: `agent-${Date.now()}`,
      email: `agent-${Date.now()}@example.com`,
      password: "supersecret",
    });

    location = await Location.create({
      name: "Lekki Phase 1",
      slug: `lekki-phase-1-${Date.now()}`,
      state: "Lagos",
    });

    return {
      reference: "REF1042",
      title: "4 Bedroom Duplex in Lekki Phase 1",
      slug: "4-bedroom-duplex-lekki-phase-1-ref1042",
      listingType: "sale",
      propertyType: "duplex",
      agent: agent._id,
      location: location._id,
      state: "Lagos",
      landmark: "Opposite Shoprite, Circle Mall",
      price: { amount: 250000000, currency: "NGN" },
      ...overrides,
    };
  }

  it("creates a valid sale listing", async () => {
    const property = await Property.create(await buildProperty());

    expect(property.reference).toBe("REF1042");
    // Defaults matter: a new listing must not be publicly visible by accident.
    expect(property.publicationState).toBe("draft");
    expect(property.status).toBe("available");
    expect(property.price.currency).toBe("NGN");
  });

  it("requires a landmark, because many properties have no formal address", async () => {
    const data = await buildProperty({ landmark: undefined });

    await expect(Property.create(data)).rejects.toThrow(/landmark is required/i);
  });

  it("rejects an agency fee above the Lagos 10% statutory cap", async () => {
    const data = await buildProperty({
      listingType: "rent",
      price: undefined,
      rent: { amount: 5000000, agencyFeePct: 15 },
    });

    // Publishing a 15% fee in Lagos is unlawful, so this must fail at write time
    // rather than be caught (or not) by whoever reads the listing.
    await expect(Property.create(data)).rejects.toThrow(/cannot exceed 10%/i);
  });

  it("rejects more than one year of advance rent in Lagos", async () => {
    const data = await buildProperty({
      listingType: "rent",
      price: undefined,
      rent: { amount: 5000000, advanceYears: 2 },
    });

    await expect(Property.create(data)).rejects.toThrow(/cannot exceed 1 year/i);
  });

  it("allows the same terms in a state without a statutory cap", async () => {
    const data = await buildProperty({
      state: "Ogun",
      listingType: "rent",
      price: undefined,
      rent: { amount: 3000000, agencyFeePct: 15, advanceYears: 2 },
    });

    // The cap is Lagos law, not a universal rule — the state table exists precisely
    // so other states can differ.
    const property = await Property.create(data);
    expect(property.rent.agencyFeePct).toBe(15);
  });

  it("defaults rent period to per annum, the Nigerian norm", async () => {
    const data = await buildProperty({
      listingType: "rent",
      price: undefined,
      rent: { amount: 4500000 },
    });

    const property = await Property.create(data);
    expect(property.rent.period).toBe("per_annum");
  });

  it("requires rent terms on a rental listing", async () => {
    const data = await buildProperty({ listingType: "rent", price: undefined });

    await expect(Property.create(data)).rejects.toThrow(/rent amount is required/i);
  });

  it("rejects rent terms on a sale listing", async () => {
    const data = await buildProperty({ rent: { amount: 4500000 } });

    await expect(Property.create(data)).rejects.toThrow(/only valid on a rental/i);
  });

  it("requires a price on a sale unless it is price-on-request", async () => {
    const missingPrice = await buildProperty({ price: undefined });
    await expect(Property.create(missingPrice)).rejects.toThrow(/price is required/i);

    // Price-on-request is a genuine state, not a missing value.
    const onRequest = await buildProperty({
      reference: "REF1043",
      slug: "on-request-ref1043",
      price: { onRequest: true },
    });
    const property = await Property.create(onRequest);
    expect(property.price.onRequest).toBe(true);
    expect(property.price.amount).toBeUndefined();
  });

  it("requires a gazette number for an excision title", async () => {
    const data = await buildProperty({
      propertyType: "land",
      landTitle: { type: "excision" },
    });

    await expect(Property.create(data)).rejects.toThrow(/gazette number is required/i);
  });

  it("accepts an enumerated C of O title", async () => {
    const data = await buildProperty({
      propertyType: "land",
      landTitle: { type: "c_of_o", freeFromGovernmentAcquisition: true },
    });

    const property = await Property.create(data);
    expect(property.landTitle.type).toBe("c_of_o");
  });

  it("rejects a title type outside the enumeration", async () => {
    const data = await buildProperty({
      landTitle: { type: "probably_fine_trust_me" },
    });

    await expect(Property.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it("keeps bathrooms and toilets as separate counts", async () => {
    const data = await buildProperty({ bathrooms: 4, toilets: 5 });

    // Nigerian listings quote both, and they are genuinely different numbers.
    const property = await Property.create(data);
    expect(property.bathrooms).toBe(4);
    expect(property.toilets).toBe(5);
  });

  it("excludes private documents from ordinary queries", async () => {
    const data = await buildProperty({
      documents: [{ label: "C of O scan", url: "https://example.com/doc.pdf" }],
    });
    await Property.create(data);

    const found = await Property.findOne({ reference: "REF1042" });
    // select:false — a public listings endpoint cannot leak these by forgetting to
    // project them away.
    expect(found.documents).toBeUndefined();

    const withDocs = await Property.findOne({ reference: "REF1042" }).select("+documents");
    expect(withDocs.documents).toHaveLength(1);
  });

  it("stamps publishedAt once, on first publication", async () => {
    const property = await Property.create(await buildProperty());
    expect(property.publishedAt).toBeUndefined();

    property.publicationState = "published";
    await property.save();
    const firstPublishedAt = property.publishedAt;
    expect(firstPublishedAt).toBeInstanceOf(Date);

    // Re-publishing after an edit must not reset it, or an old listing would jump
    // back to the top of "recent listings".
    property.publicationState = "draft";
    await property.save();
    property.publicationState = "published";
    await property.save();
    expect(property.publishedAt).toEqual(firstPublishedAt);
  });

  it("enforces unique slugs and references", async () => {
    const data = await buildProperty();
    await Property.create(data);
    // Indexes are built asynchronously; wait before relying on the constraint.
    await Property.syncIndexes();

    await expect(Property.create(await buildProperty())).rejects.toThrow();
  });
});

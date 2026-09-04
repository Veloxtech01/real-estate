import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { seedBaseline, seedPages, seedTaxonomy } from "../scripts/seed.js";
import { importDemoListings } from "../scripts/importDemoListings.js";

import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import LocationAlias from "../model/locationAliasModel.js";
import Taxonomy from "../model/taxonomyModel.js";
import Page from "../model/pageModel.js";
import Settings from "../model/settingsModel.js";
import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_FILE = path.resolve(__dirname, "../../nigerian_real_estate_dummy_data_200.json");

/**
 * Seed script tests.
 *
 * The seed is what provisions every future client copy (§9), so the properties worth
 * proving are that it produces valid data, that it is safe to re-run, and that it
 * never overwrites content a client has already edited.
 */
describe("Baseline seed", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  it("provisions taxonomy, locations, aliases, pages, settings and an admin", async () => {
    const summary = await seedBaseline({ adminPassword: "seed-password" });

    expect(await Taxonomy.countDocuments()).toBe(summary.taxonomy);
    expect(await Location.countDocuments()).toBe(summary.locations);
    expect(await Page.countDocuments()).toBe(summary.pages);
    expect(await LocationAlias.countDocuments()).toBeGreaterThan(0);
    expect(summary.admin.created).toBe(true);

    const settings = await Settings.get();
    expect(settings.agencyName).toBe("Your Agency Name");
  });

  it("is idempotent — re-running does not duplicate anything", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    const counts = {
      taxonomy: await Taxonomy.countDocuments(),
      locations: await Location.countDocuments(),
      pages: await Page.countDocuments(),
      agents: await Agent.countDocuments(),
    };

    await seedBaseline({ adminPassword: "seed-password" });

    expect(await Taxonomy.countDocuments()).toBe(counts.taxonomy);
    expect(await Location.countDocuments()).toBe(counts.locations);
    expect(await Page.countDocuments()).toBe(counts.pages);
    expect(await Agent.countDocuments()).toBe(counts.agents);
  });

  it("never overwrites page copy the client has already edited", async () => {
    await seedPages();

    const home = await Page.findOne({ key: "home" });
    home.sections[0].data.headline = "Lagos homes, honestly priced";
    home.markModified("sections");
    await home.save();

    // Re-seeding is expected after adding a new page; it must not revert edits, or
    // content-in-the-database (§9) would be worthless.
    await seedPages();

    const after = await Page.findOne({ key: "home" });
    expect(after.sections[0].data.headline).toBe("Lagos homes, honestly priced");
  });

  it("creates an administrator who can publish, and hashes the seeded password", async () => {
    await seedBaseline({ adminPassword: "seed-password" });

    const admin = await Agent.findOne({ role: "administrator" }).select("+password");
    expect(admin.canPublish).toBe(true);
    // The account must not be listed on the public team page.
    expect(admin.isPublic).toBe(false);
    expect(admin.password).not.toBe("seed-password");
    expect(await admin.comparePassword("seed-password")).toBe(true);
  });

  it("seeds taxonomy terms with the aliases the AI search validates against", async () => {
    await seedTaxonomy();

    // §5.4: "BQ" is what a visitor types; boys_quarters is what the database knows.
    const bq = await Taxonomy.findOne({ key: "boys_quarters" });
    expect(bq.aliases).toContain("bq");
  });

  it("does not point an alias at a location that was never seeded", async () => {
    await seedBaseline({ adminPassword: "seed-password" });

    const aliases = await LocationAlias.find({}).populate("location");
    // A dangling alias would silently resolve a search to nothing.
    for (const alias of aliases) {
      expect(alias.location).not.toBeNull();
    }
  });
});

describe("Demo listing import", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  it("imports the sample listings as valid, published properties", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    const result = await importDemoListings({
      filePath: DEMO_FILE,
      demoPassword: "demo-password",
    });

    // Exact, not "more than 100": every seeded location must cover every area in the
    // sample data, and a silent skip of half the listings should fail this test.
    expect(result.properties).toBe(200);
    expect(result.media).toBe(600);

    const property = await Property.findOne({ listingType: "sale" });
    expect(property.publicationState).toBe("published");
    // The schema requires a landmark; the sample data has none, so the importer
    // synthesises one rather than failing every insert.
    expect(property.landmark).toBeTruthy();
    expect(property.state).toBeTruthy();
  });

  it("collapses the marketplace-shaped sample agents into a small agency staff", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    const result = await importDemoListings({
      filePath: DEMO_FILE,
      demoPassword: "demo-password",
    });

    // The sample data carries 153 agents across many companies; this is a
    // single-agency site (§1), so only a handful become staff.
    expect(result.agents).toBe(8);
  });

  it("maps rental listings to annual rent, the Nigerian norm", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });

    const rental = await Property.findOne({ listingType: "rent" });
    expect(rental.rent.amount).toBeGreaterThan(0);
    expect(rental.rent.period).toBe("per_annum");
    // Rent terms and a sale price are mutually exclusive.
    expect(rental.price?.amount).toBeUndefined();
  });

  it("gives every imported property a cover image from its gallery", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });

    const property = await Property.findOne({}).populate("coverImage");
    expect(property.coverImage).toBeTruthy();
    expect(property.coverImage.displayOrder).toBe(0);

    const gallery = await PropertyMedia.find({ property: property._id }).sort("displayOrder");
    expect(gallery).toHaveLength(3);
  });

  it("gives every demo listing real photography, not grey placeholders", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });

    const media = await PropertyMedia.find({}).lean();

    expect(media.length).toBeGreaterThan(0);

    for (const item of media) {
      // placehold.co stubs were the whole reason the demo site looked unfinished.
      expect(item.url).not.toContain("placehold.co");
      expect(item.url).toMatch(/^https:\/\/images\.pexels\.com\/photos\//);
      // Real dimensions, so next/image reserves the right space and the grid does
      // not reflow as photos arrive.
      expect(item.width).toBe(1200);
      expect(item.height).toBe(800);
      expect(item.thumbnailUrl).toContain("w=400");
      expect(item.alt).toMatch(/ — /);
    }
  });

  it("never repeats a photo within one listing's gallery", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });

    const media = await PropertyMedia.find({}).lean();
    const byProperty = new Map();

    for (const item of media) {
      const key = String(item.property);
      if (!byProperty.has(key)) byProperty.set(key, []);
      byProperty.get(key).push(item.url);
    }

    for (const [property, urls] of byProperty) {
      expect(new Set(urls).size, property).toBe(urls.length);
    }
  });

  it("converts land sizes to square metres and maps features to taxonomy", async () => {
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });

    const withLand = await Property.findOne({ landSizeSqm: { $gt: 0 } });
    expect(withLand.landSizeSqm).toBeGreaterThan(0);

    const tagged = await Property.findOne({ tags: { $ne: [] } }).populate("tags");
    expect(tagged.tags[0].key).toBeTruthy();

    // "BQ"/"Boys Quarters" become a count, not a tag, because the schema models it
    // as a number.
    const withBq = await Property.findOne({ boysQuarters: { $gt: 0 } });
    expect(withBq).toBeTruthy();
  });
});

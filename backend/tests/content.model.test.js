import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import Enquiry from "../model/enquiryModel.js";
import Viewing from "../model/viewingModel.js";
import BlogPost from "../model/blogPostModel.js";
import Page from "../model/pageModel.js";
import Testimonial from "../model/testimonialModel.js";
import SearchLog from "../model/searchLogModel.js";
import Settings from "../model/settingsModel.js";

/**
 * Tests for the lead, content and settings collections.
 *
 * Concentrated on the behaviour that isn't obvious from the field list: pipeline
 * timestamping, the settings singleton, and the rule that search logs must never
 * carry personal data.
 */
describe("Enquiry model", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  const baseEnquiry = {
    name: "Chidi Nwosu",
    phone: "+2348012345678",
    message: "Is this still available?",
  };

  it("defaults a new lead to the top of the inbox pipeline", async () => {
    const enquiry = await Enquiry.create(baseEnquiry);

    expect(enquiry.status).toBe("new");
    expect(enquiry.type).toBe("property_enquiry");
    expect(enquiry.contactedAt).toBeUndefined();
  });

  it("requires a phone number, the primary channel in this market", async () => {
    await expect(
      Enquiry.create({ name: "Chidi Nwosu", message: "Hello" })
    ).rejects.toThrow(/phone number is required/i);
  });

  it("stamps contactedAt once, on the first move off 'new'", async () => {
    const enquiry = await Enquiry.create(baseEnquiry);

    enquiry.status = "contacted";
    await enquiry.save();
    const firstContact = enquiry.contactedAt;
    expect(firstContact).toBeInstanceOf(Date);

    // A later status change must not overwrite the original response time.
    enquiry.status = "viewing_booked";
    await enquiry.save();
    expect(enquiry.contactedAt).toEqual(firstContact);

    enquiry.status = "closed";
    await enquiry.save();
    expect(enquiry.closedAt).toBeInstanceOf(Date);
  });

  it("supports the landlord supply pipeline as a first-class type", async () => {
    const enquiry = await Enquiry.create({
      ...baseEnquiry,
      type: "list_property",
      source: "list_property_page",
    });

    expect(enquiry.type).toBe("list_property");
  });

  it("keeps internal notes out of ordinary queries", async () => {
    const created = await Enquiry.create({ ...baseEnquiry, notes: "Tyre kicker" });

    const found = await Enquiry.findById(created._id);
    expect(found.notes).toBeUndefined();
  });

  it("tracks consent separately from marketing opt-in", async () => {
    // Agreeing to a callback about one property is not agreement to receive alerts.
    const enquiry = await Enquiry.create({ ...baseEnquiry, consentGiven: true });

    expect(enquiry.consentGiven).toBe(true);
    expect(enquiry.marketingOptIn).toBe(false);
  });
});

describe("Viewing model", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  /** Viewings require a property, so each test creates a throwaway ObjectId ref. */
  const baseViewing = () => ({
    property: new mongoose.Types.ObjectId(),
    name: "Ngozi Bello",
    phone: "+2348098765432",
    requestedFor: new Date("2026-10-01T10:00:00Z"),
  });

  it("copies the requested slot to scheduledFor on acceptance", async () => {
    const viewing = await Viewing.create(baseViewing());
    expect(viewing.status).toBe("requested");

    viewing.status = "accepted";
    await viewing.save();

    // Accepting without changing the date means the requested slot stands.
    expect(viewing.scheduledFor).toEqual(viewing.requestedFor);
    expect(viewing.respondedAt).toBeInstanceOf(Date);
  });

  it("keeps a rescheduled date distinct from the requested one", async () => {
    const viewing = await Viewing.create(baseViewing());

    viewing.status = "rescheduled";
    viewing.scheduledFor = new Date("2026-10-03T14:00:00Z");
    await viewing.save();

    expect(viewing.scheduledFor).not.toEqual(viewing.requestedFor);
  });
});

describe("SearchLog model", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  it("records a parsed AI search with its filters and outcome", async () => {
    const log = await SearchLog.create({
      rawQuery: "3 bedroom flat in Lekki under 100 million with parking",
      normalizedQuery: "3 bedroom flat in lekki under 100 million with parking",
      source: "ai",
      filters: { propertyType: "apartment", bedroomsMin: 3, priceMax: 100000000 },
      resultCount: 4,
      cacheHit: true,
    });

    expect(log.filters.bedroomsMin).toBe(3);
    expect(log.cacheHit).toBe(true);
  });

  it("stores no personal-data fields at all", async () => {
    // §5.7 is explicit that personal data is excluded from these logs — assert the
    // schema simply has nowhere to put it, rather than trusting call sites.
    const paths = Object.keys(SearchLog.schema.paths);

    for (const forbidden of ["name", "email", "phone", "ip", "ipAddress", "userId"]) {
      expect(paths).not.toContain(forbidden);
    }
  });

  it("records which constraints were relaxed on a zero-result search", async () => {
    const log = await SearchLog.create({
      normalizedQuery: "5 bedroom mansion in ikoyi under 10 million",
      source: "ai",
      resultCount: 0,
      relaxedConstraints: ["price_band", "adjacent_locations"],
    });

    expect(log.resultCount).toBe(0);
    expect(log.relaxedConstraints).toEqual(["price_band", "adjacent_locations"]);
  });
});

describe("BlogPost and Page models", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  it("stamps a blog post's publishedAt only on first publication", async () => {
    const post = await BlogPost.create({
      title: "Lagos rental market, Q3 2026",
      slug: "lagos-rental-market-q3-2026",
      body: "Rents in Lekki...",
    });
    expect(post.publishedAt).toBeUndefined();

    post.publicationState = "published";
    await post.save();
    const first = post.publishedAt;

    post.publicationState = "draft";
    await post.save();
    post.publicationState = "published";
    await post.save();

    expect(post.publishedAt).toEqual(first);
  });

  it("stores page content as ordered sections, not hardcoded copy", async () => {
    const page = await Page.create({
      key: "home",
      title: "Home",
      isSystem: true,
      sections: [
        { type: "hero", order: 0, data: { headline: "Find your next home in Lagos" } },
        { type: "servicesGrid", order: 1, data: { items: ["Sales", "Lettings"] } },
      ],
    });

    // §9: wording changes must be an admin edit, not a deployment.
    expect(page.sections[0].data.headline).toBe("Find your next home in Lagos");
    expect(page.sections[1].isVisible).toBe(true);
  });

  it("allows many pages without a slug, but still enforces slug uniqueness", async () => {
    await Page.syncIndexes();

    // Several slug-less pages must coexist — the unique index is partial, covering
    // string slugs only.
    await Page.create({ key: "home", title: "Home" });
    await Page.create({ key: "about", title: "About" });
    expect(await Page.countDocuments()).toBe(2);

    // A real slug is still unique.
    await Page.create({ key: "services.sales", slug: "sales", title: "Sales" });
    await expect(
      Page.create({ key: "services.lettings", slug: "sales", title: "Lettings" })
    ).rejects.toThrow();
  });
});

describe("Testimonial model", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  it("defaults to unpublished, because testimonials are agency-curated", async () => {
    const testimonial = await Testimonial.create({
      clientName: "Mrs Adeyemi",
      quote: "They found us a flat in three weeks.",
    });

    // There is no public submission path; staff enter and then publish these.
    expect(testimonial.isPublished).toBe(false);
  });
});

describe("Settings model", () => {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  it("creates the singleton on first get and returns the same document after", async () => {
    const first = await Settings.get();
    const second = await Settings.get();

    expect(String(first._id)).toBe(String(second._id));
    expect(await Settings.countDocuments()).toBe(1);
  });

  it("refuses a second settings document", async () => {
    await Settings.get();
    await Settings.syncIndexes();

    await expect(
      Settings.create({ key: "site", agencyName: "Impostor Agency" })
    ).rejects.toThrow();
  });

  it("defaults AI search to disabled with no spend allowance", async () => {
    const settings = await Settings.get();

    // The filter UI must work with no AI configured — AI search is additive (§5.6).
    expect(settings.aiSearch.enabled).toBe(false);
    expect(settings.aiSearch.monthlySpendCapUsd).toBe(0);
    expect(settings.aiSearch.timeoutMs).toBe(2000);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { connectTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import { importDemoListings } from "../scripts/importDemoListings.js";
import Property from "../model/propertyModel.js";
import Enquiry from "../model/enquiryModel.js";
import Viewing from "../model/viewingModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_FILE = path.resolve(__dirname, "../../nigerian_real_estate_dummy_data_200.json");

/**
 * Lead-capture API tests.
 *
 * Leads are the commercial point of the site (§1), so these focus on the paths where
 * a lead could be silently lost or mis-filed, and on the NDPA consent handling (§11).
 */
describe("Enquiry API", () => {
  const app = createApp();
  let property;

  beforeAll(async () => {
    await connectTestDB();
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });
    property = await Property.findOne({});
  }, 120000);

  afterAll(closeTestDB);

  it("accepts an enquiry against a property and routes it to that agent", async () => {
    const response = await request(app).post("/api/enquiries").send({
      name: "Chidi Nwosu",
      phone: "+2348012345678",
      email: "chidi@example.com",
      message: "Is this still available?",
      property: property.slug,
      source: "property_page",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const enquiry = await Enquiry.findById(response.body.data.enquiry.id);
    expect(String(enquiry.property)).toBe(String(property._id));
    // Denormalised at creation so reassigning the listing never moves historic leads.
    expect(String(enquiry.agent)).toBe(String(property.agent));
    expect(enquiry.status).toBe("new");
  });

  it("rejects an enquiry with no name or phone", async () => {
    const response = await request(app)
      .post("/api/enquiries")
      .send({ message: "Call me" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    // Field-level details so the form can show errors next to the inputs.
    expect(response.body.details).toHaveProperty("name");
    expect(response.body.details).toHaveProperty("phone");
  });

  it("accepts a general enquiry with no property attached", async () => {
    const response = await request(app)
      .post("/api/enquiries")
      .send({ name: "Ngozi Bello", phone: "+2348098765432", type: "general" });

    expect(response.status).toBe(201);

    const enquiry = await Enquiry.findById(response.body.data.enquiry.id);
    expect(enquiry.property).toBeNull();
  });

  it("records the landlord supply pipeline as its own enquiry type", async () => {
    const response = await request(app).post("/api/enquiries").send({
      name: "Mr Adeyemi",
      phone: "+2348011111111",
      type: "list_property",
      source: "list_property_page",
      message: "I have a 3 bedroom flat in Yaba to let.",
    });

    const enquiry = await Enquiry.findById(response.body.data.enquiry.id);
    // §3 — arguably the most commercially valuable form on the site.
    expect(enquiry.type).toBe("list_property");
  });

  it("stores the unmet requirement from a no-match alert", async () => {
    const response = await request(app).post("/api/enquiries").send({
      name: "Tunde Bakare",
      phone: "+2348022222222",
      source: "no_match_alert",
      requirement: { location: "Ikoyi", bedroomsMin: 5, priceMax: 50000000 },
    });

    const enquiry = await Enquiry.findById(response.body.data.enquiry.id);
    // §5.5 — a qualified lead with a known requirement is worth more than the search.
    expect(enquiry.requirement.bedroomsMin).toBe(5);
  });

  it("timestamps consent, and keeps marketing opt-in separate", async () => {
    const response = await request(app).post("/api/enquiries").send({
      name: "Amaka Obi",
      phone: "+2348033333333",
      consentGiven: true,
    });

    const enquiry = await Enquiry.findById(response.body.data.enquiry.id);
    // NDPA 2023 (§11): record when consent was given, not merely that it was.
    expect(enquiry.consentGiven).toBe(true);
    expect(enquiry.consentedAt).toBeInstanceOf(Date);
    expect(enquiry.marketingOptIn).toBe(false);
  });

  it("404s an enquiry against an unknown property rather than filing it unattached", async () => {
    const response = await request(app).post("/api/enquiries").send({
      name: "Chidi Nwosu",
      phone: "+2348012345678",
      property: "no-such-property-ref9999",
    });

    expect(response.status).toBe(404);
  });

  it("falls back to a default type when the front end sends an unknown one", async () => {
    const response = await request(app).post("/api/enquiries").send({
      name: "Chidi Nwosu",
      phone: "+2348012345678",
      type: "definitely_not_a_type",
    });

    // A stale front end must not cost the agency a lead over a label.
    expect(response.status).toBe(201);
    const enquiry = await Enquiry.findById(response.body.data.enquiry.id);
    expect(enquiry.type).toBe("property_enquiry");
  });
});

describe("Viewing API", () => {
  const app = createApp();
  let property;

  beforeAll(async () => {
    await connectTestDB();
    await seedBaseline({ adminPassword: "seed-password" });
    await importDemoListings({ filePath: DEMO_FILE, demoPassword: "demo-password" });
    property = await Property.findOne({});
  }, 120000);

  afterAll(closeTestDB);

  /** A date comfortably in the future, so the test isn't time-sensitive. */
  const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  it("accepts a viewing request for a property", async () => {
    const response = await request(app).post("/api/viewings").send({
      property: property.slug,
      name: "Ngozi Bello",
      phone: "+2348098765432",
      email: "ngozi@example.com",
      requestedFor: futureDate(),
    });

    expect(response.status).toBe(201);

    const viewing = await Viewing.findById(response.body.data.viewing.id);
    expect(viewing.status).toBe("requested");
    expect(String(viewing.agent)).toBe(String(property.agent));
  });

  it("rejects a viewing in the past", async () => {
    const response = await request(app).post("/api/viewings").send({
      property: property.slug,
      name: "Ngozi Bello",
      phone: "+2348098765432",
      requestedFor: "2020-01-01T10:00:00Z",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/future/i);
  });

  it("rejects a viewing with no valid date", async () => {
    const response = await request(app).post("/api/viewings").send({
      property: property.slug,
      name: "Ngozi Bello",
      phone: "+2348098765432",
      requestedFor: "next tuesday sometime",
    });

    expect(response.status).toBe(400);
  });

  it("requires a property — a viewing of nothing is not a request", async () => {
    const response = await request(app).post("/api/viewings").send({
      name: "Ngozi Bello",
      phone: "+2348098765432",
      requestedFor: futureDate(),
    });

    expect(response.status).toBe(400);
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";

/**
 * The two endpoints the listing editor added: the single-record read and the shared
 * reference payload.
 *
 * As with the other admin suites, the cases that matter are the boundaries — an agent
 * reaching a colleague's record, and staff data leaking into a payload that exists
 * only to fill in dropdowns.
 */

// Tests must not depend on a developer's .env, so the signing key is fixed here.
process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/**
 * Logs in and returns the session cookie.
 *
 * Takes: email (string), password (string).
 * Returns: a promise resolving to the Set-Cookie value for subsequent requests.
 */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("GET /api/admin/reference", () => {
  let adminCookie;
  let agentCookie;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
      canPublish: false,
    });

    // Deactivated staff must not appear in the assignment dropdown — a listing
    // assigned to someone who has left routes its enquiries nowhere.
    await Agent.create({
      name: "Former Agent",
      slug: "former-agent",
      email: "former@example.com",
      password: "agent-password",
      role: "agent",
      isActive: false,
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  it("requires a session", async () => {
    const response = await request(app).get("/api/admin/reference");
    expect(response.status).toBe(401);
  });

  it("serves every enum the editor renders a control for", async () => {
    const response = await request(app)
      .get("/api/admin/reference")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    const { data } = response.body;

    // The whole point of the endpoint: these come from constants.js, not a mirrored
    // copy in the front end that could drift from the schema enums.
    expect(data.listingStatuses).toContain("available");
    expect(data.publicationStates).toEqual(["draft", "published"]);
    expect(data.chargePeriods).toContain("one_off");
    expect(data.powerSources.length).toBeGreaterThan(0);
    expect(data.waterSources).toContain("borehole");
    expect(data.meteringTypes).toContain("prepaid");
    expect(data.floodRiskLevels).toContain("high");
    expect(data.roadConditions).toContain("tarred");
    expect(data.landUnits.plot_lagos).toBe(464);
  });

  it("includes the statutory rent table so the form can warn before submitting", async () => {
    const response = await request(app)
      .get("/api/admin/reference")
      .set("Cookie", adminCookie);

    expect(response.body.data.stateRentRules.Lagos).toEqual({
      maxAgencyFeePct: 10,
      maxAdvanceYears: 1,
    });
    // The permissive fallback for states with no known cap.
    expect(response.body.data.stateRentRules.default).toBeDefined();
  });

  it("gives an administrator the active staff roster only", async () => {
    const response = await request(app)
      .get("/api/admin/reference")
      .set("Cookie", adminCookie);

    const names = response.body.data.agents.map((agent) => agent.name);
    expect(names).toContain("Junior Agent");
    expect(names).not.toContain("Former Agent");
  });

  it("never projects credentials or contact details onto the roster", async () => {
    const response = await request(app)
      .get("/api/admin/reference")
      .set("Cookie", adminCookie);

    const payload = JSON.stringify(response.body);
    expect(payload).not.toMatch(/password/i);
    expect(payload).not.toMatch(/junior@example\.com/);
  });

  it("omits the roster entirely for an agent", async () => {
    const response = await request(app)
      .get("/api/admin/reference")
      .set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    // An agent cannot reassign ownership, so the directory is not theirs to read.
    expect(response.body.data.agents).toBeUndefined();
    // The enums they do need are still there.
    expect(response.body.data.propertyTypes.length).toBeGreaterThan(0);
  });
});

describe("GET /api/admin/properties/:id", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    location = await Location.findOne({ state: "Lagos" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
      canPublish: false,
    });

    otherAgent = await Agent.create({
      name: "Other Agent",
      slug: "other-agent",
      email: "other@example.com",
      password: "agent-password",
      role: "agent",
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  /** Minimum valid listing payload. */
  const listingBody = () => ({
    title: "3 Bedroom Flat in Lekki",
    listingType: "sale",
    propertyType: "apartment",
    location: String(location._id),
    landmark: "Opposite Circle Mall",
    price: { amount: 95000000, currency: "NGN" },
  });

  /**
   * Creates a listing through the API and returns the raw record.
   *
   * Takes: cookie (string), overrides (object) merged into the body.
   * Returns: a promise resolving to the created property JSON.
   */
  async function createListing(cookie, overrides = {}) {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", cookie)
      .send({ ...listingBody(), ...overrides });

    return response.body.data.property;
  }

  it("returns a draft listing with its gallery in display order", async () => {
    const created = await createListing(adminCookie);

    // Two images, deliberately inserted out of order, to prove the sort.
    await PropertyMedia.create([
      {
        property: created._id,
        url: "https://cdn.example.com/second.jpg",
        publicId: "second",
        displayOrder: 2,
      },
      {
        property: created._id,
        url: "https://cdn.example.com/first.jpg",
        publicId: "first",
        displayOrder: 1,
      },
    ]);

    const response = await request(app)
      .get(`/api/admin/properties/${created._id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.property.reference).toBe(created.reference);
    // The cover picker renders this array as-is, so the order is part of the contract.
    expect(response.body.data.media.map((item) => item.publicId)).toEqual([
      "first",
      "second",
    ]);
  });

  it("populates the fields the editor needs to label its selects", async () => {
    const created = await createListing(adminCookie);

    const response = await request(app)
      .get(`/api/admin/properties/${created._id}`)
      .set("Cookie", adminCookie);

    const { property } = response.body.data;
    expect(property.location.name).toBe(location.name);
    expect(property.agent.name).toBeDefined();
  });

  it("never exposes the private documents array", async () => {
    const created = await createListing(adminCookie);

    // Written directly, since documents is not a writable field on the API.
    await Property.updateOne(
      { _id: created._id },
      { $set: { documents: [{ label: "Title scan", url: "https://x/scan.pdf" }] } }
    );

    const response = await request(app)
      .get(`/api/admin/properties/${created._id}`)
      .set("Cookie", adminCookie);

    // select:false on the model; this screen has no need for it and must not leak it.
    expect(response.body.data.property.documents).toBeUndefined();
  });

  it("returns a soft-deleted listing, so it can still be reviewed", async () => {
    const created = await createListing(adminCookie);
    await request(app)
      .delete(`/api/admin/properties/${created._id}`)
      .set("Cookie", adminCookie);

    const response = await request(app)
      .get(`/api/admin/properties/${created._id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.property.deletedAt).not.toBeNull();
  });

  it("404s for an unknown id", async () => {
    const response = await request(app)
      .get("/api/admin/properties/64b7f9c2a1b2c3d4e5f60718")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });

  it("403s when an agent opens a colleague's listing", async () => {
    const created = await createListing(adminCookie, { agent: String(otherAgent._id) });

    const response = await request(app)
      .get(`/api/admin/properties/${created._id}`)
      .set("Cookie", agentCookie);

    // 403, not 404: these are authenticated colleagues, and pretending the record
    // doesn't exist would be dishonest. The public surface still 404s.
    expect(response.status).toBe(403);
  });

  it("lets an agent open their own listing", async () => {
    const created = await createListing(agentCookie);

    const response = await request(app)
      .get(`/api/admin/properties/${created._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(200);
  });
});

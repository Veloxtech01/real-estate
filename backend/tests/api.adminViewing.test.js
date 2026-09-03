import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import Property from "../model/propertyModel.js";
import Viewing from "../model/viewingModel.js";

/**
 * Viewing management tests.
 *
 * Two boundaries matter here: the §7 ownership rule, and the status transition
 * whitelist that stops a completed viewing being reopened.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** A date safely in the future, so "must be upcoming" checks pass deterministically. */
function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Logs in and returns the Set-Cookie value for subsequent requests. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Viewing management", () => {
  let adminCookie;
  let agentCookie;
  let agentId;
  let otherAgentId;
  let propertyId;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    const agent = await Agent.create({
      name: "Ada Agent",
      slug: "ada-agent",
      email: "ada@example.com",
      password: "agent-password",
      role: "agent",
    });
    const other = await Agent.create({
      name: "Bola Agent",
      slug: "bola-agent",
      email: "bola@example.com",
      password: "agent-password",
      role: "agent",
    });

    agentId = agent._id;
    otherAgentId = other._id;

    // Unlike an enquiry, a viewing REQUIRES a property — you cannot ask to view
    // nothing. Every fixture below therefore references this listing.
    const location = await Location.findOne({ state: "Lagos" });
    const property = await Property.create({
      title: "3 Bedroom Flat in Lekki",
      // slug, reference and state are derived by the admin controller on create, not
      // by the model — creating directly means supplying them here.
      slug: "3-bedroom-flat-in-lekki-ref9001",
      reference: "REF9001",
      state: location.state,
      listingType: "sale",
      propertyType: "apartment",
      location: location._id,
      landmark: "Opposite Circle Mall",
      price: { amount: 95000000, currency: "NGN" },
      agent: agentId,
    });
    propertyId = property._id;

    await Viewing.create([
      {
        name: "Mine",
        phone: "+2348010000001",
        email: "mine@example.com",
        agent: agentId,
        property: propertyId,
        requestedFor: daysFromNow(3),
        status: "requested",
      },
      {
        name: "Colleague",
        phone: "+2348010000002",
        agent: otherAgentId,
        property: propertyId,
        requestedFor: daysFromNow(4),
        status: "requested",
      },
      {
        name: "Unassigned",
        phone: "+2348010000003",
        property: propertyId,
        requestedFor: daysFromNow(5),
        status: "requested",
      },
    ]);

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("ada@example.com", "agent-password");
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/admin/viewings");
    expect(response.status).toBe(401);
  });

  it("shows an agent only their own viewings", async () => {
    const response = await request(app).get("/api/admin/viewings").set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.viewings).toHaveLength(1);
    expect(response.body.data.viewings[0].name).toBe("Mine");
  });

  it("shows an administrator all viewings", async () => {
    const response = await request(app).get("/api/admin/viewings").set("Cookie", adminCookie);
    expect(response.body.data.viewings).toHaveLength(3);
  });

  it("sorts the diary soonest-first", async () => {
    const response = await request(app).get("/api/admin/viewings").set("Cookie", adminCookie);

    const dates = response.body.data.viewings.map((v) => new Date(v.requestedFor).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("returns 403 for a colleague's viewing", async () => {
    const viewing = await Viewing.findOne({ name: "Colleague" });

    const response = await request(app)
      .get(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
  });

  it("accepts a request and inherits requestedFor when no time is given", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "accepted" });

    expect(response.status).toBe(200);

    const stored = await Viewing.findById(viewing._id);
    expect(stored.status).toBe("accepted");
    // Accepting the ask as-is is the common case; the client shouldn't have to echo
    // the date back.
    expect(stored.scheduledFor.getTime()).toBe(stored.requestedFor.getTime());
    expect(stored.respondedAt).toBeTruthy();
  });

  it("accepts with an explicit scheduledFor", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    const when = daysFromNow(7);

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "accepted", scheduledFor: when.toISOString() });

    expect(response.status).toBe(200);
    const stored = await Viewing.findById(viewing._id);
    expect(stored.scheduledFor.toISOString()).toBe(when.toISOString());
  });

  it("rejects with a message the prospect will see", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rejected", responseMessage: "Property is under offer." });

    expect(response.status).toBe(200);
    const stored = await Viewing.findById(viewing._id);
    expect(stored.status).toBe("rejected");
    expect(stored.responseMessage).toBe("Property is under offer.");
  });

  it("requires a new future time to reschedule", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const missing = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rescheduled" });
    expect(missing.status).toBe(400);

    const past = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rescheduled", scheduledFor: daysFromNow(-2).toISOString() });
    expect(past.status).toBe(400);
  });

  it("reschedules to a valid future time", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    const when = daysFromNow(10);

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rescheduled", scheduledFor: when.toISOString() });

    expect(response.status).toBe(200);
    const stored = await Viewing.findById(viewing._id);
    expect(stored.status).toBe("rescheduled");
    expect(stored.scheduledFor.toISOString()).toBe(when.toISOString());
  });

  it("refuses an illegal transition", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    await Viewing.updateOne({ _id: viewing._id }, { status: "completed" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "requested" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/completed/i);
  });

  it("treats re-applying the same status as a no-op", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "requested" });

    // A double-clicked button must not surface a 400.
    expect(response.status).toBe(200);
  });

  it("keeps notes out of the list and present on the detail", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    await Viewing.updateOne({ _id: viewing._id }, { notes: "Internal only note" });

    const list = await request(app).get("/api/admin/viewings").set("Cookie", agentCookie);
    expect(JSON.stringify(list.body)).not.toMatch(/Internal only note/);

    const detail = await request(app)
      .get(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie);
    expect(detail.body.data.viewing.notes).toBe("Internal only note");
  });

  it("refuses deletion by an agent and allows it for an administrator", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const refused = await request(app)
      .delete(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie);
    expect(refused.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", adminCookie);
    expect(allowed.status).toBe(204);
    expect(await Viewing.findById(viewing._id)).toBeNull();
  });

  it("filters to upcoming viewings only", async () => {
    await Viewing.create({
      name: "Past",
      phone: "+2348010000004",
      agent: agentId,
      property: propertyId,
      requestedFor: daysFromNow(-5),
      status: "completed",
    });

    const response = await request(app)
      .get("/api/admin/viewings?upcoming=true")
      .set("Cookie", agentCookie);

    const names = response.body.data.viewings.map((v) => v.name);
    expect(names).not.toContain("Past");
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Enquiry from "../model/enquiryModel.js";

/**
 * Enquiry inbox tests.
 *
 * Weighted towards the security boundary rather than the happy path: an agent must
 * never see a colleague's lead or an unassigned one, and must never widen their own
 * scope through a query parameter.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** Logs in and returns the Set-Cookie value for subsequent requests. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Enquiry inbox", () => {
  let adminCookie;
  let agentCookie;
  let agentId;
  let otherAgentId;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    // Two agents, so "my leads" can be told apart from "a colleague's leads".
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

    await Enquiry.create([
      {
        name: "Mine",
        phone: "+2348010000001",
        email: "mine@example.com",
        agent: agentId,
        status: "new",
        type: "property_enquiry",
        source: "property_page",
        consentGiven: true,
      },
      {
        name: "Colleague",
        phone: "+2348010000002",
        agent: otherAgentId,
        status: "new",
        type: "property_enquiry",
        source: "property_page",
        consentGiven: true,
      },
      {
        // No agent — a contact-page lead nobody owns yet.
        name: "Unassigned",
        phone: "+2348010000003",
        status: "new",
        type: "general",
        source: "contact_page",
        consentGiven: true,
      },
    ]);

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("ada@example.com", "agent-password");
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/admin/enquiries");
    expect(response.status).toBe(401);
  });

  it("shows an administrator every lead, assigned or not", async () => {
    const response = await request(app).get("/api/admin/enquiries").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiries).toHaveLength(3);
  });

  it("shows an agent only their own leads", async () => {
    const response = await request(app).get("/api/admin/enquiries").set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiries).toHaveLength(1);
    expect(response.body.data.enquiries[0].name).toBe("Mine");
  });

  it("hides unassigned leads from an agent", async () => {
    const response = await request(app).get("/api/admin/enquiries").set("Cookie", agentCookie);

    const names = response.body.data.enquiries.map((e) => e.name);
    expect(names).not.toContain("Unassigned");
  });

  it("does not let an agent widen their scope with ?agent=", async () => {
    // The ownership filter is applied last, so this parameter cannot override it.
    const response = await request(app)
      .get(`/api/admin/enquiries?agent=${otherAgentId}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiries).toHaveLength(1);
    expect(response.body.data.enquiries[0].name).toBe("Mine");
  });

  it("keeps internal notes out of the list response", async () => {
    await Enquiry.updateOne({ name: "Mine" }, { notes: "Secret internal note" });

    const response = await request(app).get("/api/admin/enquiries").set("Cookie", agentCookie);

    expect(JSON.stringify(response.body)).not.toMatch(/Secret internal note/);
  });

  it("includes notes on the detail response", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });
    await Enquiry.updateOne({ _id: enquiry._id }, { notes: "Secret internal note" });

    const response = await request(app)
      .get(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiry.notes).toBe("Secret internal note");
  });

  it("returns 403 when an agent opens a colleague's lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Colleague" });

    const response = await request(app)
      .get(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
  });

  it("returns 403 when an agent opens an unassigned lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Unassigned" });

    const response = await request(app)
      .get(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
  });

  it("filters by status", async () => {
    await Enquiry.updateOne({ name: "Mine" }, { status: "contacted" });

    const response = await request(app)
      .get("/api/admin/enquiries?status=contacted")
      .set("Cookie", adminCookie);

    expect(response.body.data.enquiries).toHaveLength(1);
    expect(response.body.data.enquiries[0].name).toBe("Mine");
  });

  it("searches name, phone and email", async () => {
    const byName = await request(app)
      .get("/api/admin/enquiries?q=Colleague")
      .set("Cookie", adminCookie);
    expect(byName.body.data.enquiries).toHaveLength(1);

    const byPhone = await request(app)
      .get("/api/admin/enquiries?q=0000003")
      .set("Cookie", adminCookie);
    expect(byPhone.body.data.enquiries).toHaveLength(1);

    const byEmail = await request(app)
      .get("/api/admin/enquiries?q=mine@example.com")
      .set("Cookie", adminCookie);
    expect(byEmail.body.data.enquiries).toHaveLength(1);
  });

  it("treats a regex metacharacter in the search term as a literal", async () => {
    // Unescaped, ".*" would match all three leads.
    const response = await request(app)
      .get("/api/admin/enquiries?q=.*")
      .set("Cookie", adminCookie);

    expect(response.body.data.enquiries).toHaveLength(0);
  });

  it("reports counts for every status, including zeroes", async () => {
    const response = await request(app)
      .get("/api/admin/enquiries/stats")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.stats).toMatchObject({
      new: 3,
      contacted: 0,
      viewing_booked: 0,
      closed: 0,
      total: 3,
    });
  });

  it("scopes stats to the caller", async () => {
    const response = await request(app)
      .get("/api/admin/enquiries/stats")
      .set("Cookie", agentCookie);

    expect(response.body.data.stats.total).toBe(1);
  });

  it("updates status and stamps contactedAt on the first move off new", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "contacted", notes: "Called, viewing next week" });

    expect(response.status).toBe(200);
    expect(response.body.data.enquiry.status).toBe("contacted");

    const stored = await Enquiry.findById(enquiry._id).select("+notes");
    expect(stored.contactedAt).toBeTruthy();
    expect(stored.notes).toBe("Called, viewing next week");
  });

  it("rejects an unknown status", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "abducted" });

    expect(response.status).toBe(400);
  });

  it("ignores fields outside the allow-list", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });
    const before = await Enquiry.findById(enquiry._id);

    await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "contacted", contactedAt: "2020-01-01T00:00:00Z", phone: "+000" });

    const after = await Enquiry.findById(enquiry._id);
    // contactedAt is stamped by the model hook, never accepted from the body.
    expect(after.contactedAt.getFullYear()).toBeGreaterThan(2020);
    expect(after.phone).toBe(before.phone);
  });

  it("refuses to let an agent reassign a lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ agent: otherAgentId });

    expect(response.status).toBe(403);
  });

  it("lets an administrator reassign a lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Unassigned" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", adminCookie)
      .send({ agent: agentId });

    expect(response.status).toBe(200);
    const stored = await Enquiry.findById(enquiry._id);
    expect(String(stored.agent)).toBe(String(agentId));
  });

  it("refuses deletion by an agent", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .delete(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
    expect(await Enquiry.countDocuments()).toBe(3);
  });

  it("hard-deletes for an administrator, leaving no personal data behind", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .delete(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    // NDPA erasure means the row is gone, not tombstoned with the phone number intact.
    expect(await Enquiry.findById(enquiry._id)).toBeNull();
    expect(await Enquiry.countDocuments()).toBe(2);
  });

  it("404s for a well-formed id that does not exist", async () => {
    const response = await request(app)
      .get("/api/admin/enquiries/6a99b588fcd254d91ec3ffff")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });
});

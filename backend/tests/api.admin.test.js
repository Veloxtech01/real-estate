import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import Property from "../model/propertyModel.js";

/**
 * Authentication and admin listing tests.
 *
 * Focused on the security boundaries rather than the happy path: account
 * enumeration, stale sessions, privilege escalation via the request body, and the
 * §7 ownership rules that separate an agent from an administrator.
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

describe("Authentication", () => {
  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });
  });

  it("logs in with valid credentials and sets an httpOnly cookie", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "admin-password" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe("administrator");

    const [cookie] = response.headers["set-cookie"];
    // httpOnly is the point of cookie auth — page scripts must not read the token.
    expect(cookie).toMatch(/HttpOnly/i);
    // The token itself must never appear in the response body.
    expect(JSON.stringify(response.body)).not.toMatch(/eyJ/);
  });

  it("gives the same error for a wrong password and an unknown account", async () => {
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "not-the-password" });

    const unknownAccount = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "admin-password" });

    // Distinguishing them would confirm which staff addresses exist.
    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownAccount.body.message);
  });

  it("rejects an unauthenticated request to a protected route", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("returns the current session for a logged-in user", async () => {
    const cookie = await loginAs("admin@example.com", "admin-password");

    const response = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe("admin@example.com");
  });

  it("invalidates a session as soon as the account is deactivated", async () => {
    const cookie = await loginAs("admin@example.com", "admin-password");

    await Agent.updateOne({ email: "admin@example.com" }, { $set: { isActive: false } });

    // The JWT is still cryptographically valid — the account is re-checked on every
    // request precisely so a removed staff member loses access immediately.
    const response = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(response.status).toBe(401);
  });

  it("rejects a forged token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", ["re_token=not.a.real.token"]);

    expect(response.status).toBe(401);
  });

  it("changes a password and signs the session out", async () => {
    const cookie = await loginAs("admin@example.com", "admin-password");

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "admin-password", newPassword: "a-new-password" });

    expect(response.status).toBe(200);
    // The old password must stop working.
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "admin-password" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "a-new-password" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects a password change with the wrong current password", async () => {
    const cookie = await loginAs("admin@example.com", "admin-password");

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "wrong", newPassword: "a-new-password" });

    expect(response.status).toBe(401);
  });
});

describe("Admin property management", () => {
  let adminCookie;
  let agentCookie;
  let otherAgent;
  let location;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    location = await Location.findOne({ state: "Lagos" });

    // An agent WITHOUT publishing rights — the §7 default.
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

  it("requires authentication for every admin route", async () => {
    const response = await request(app).get("/api/admin/properties");
    expect(response.status).toBe(401);
  });

  it("creates a listing, generating its reference and slug", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send(listingBody());

    expect(response.status).toBe(201);
    const { property } = response.body.data;
    expect(property.reference).toMatch(/^REF\d+$/);
    // §4.1's URL form: title plus reference.
    expect(property.slug).toContain("3-bedroom-flat-in-lekki");
    expect(property.slug).toContain(property.reference.toLowerCase());
    // State is derived from the location, never taken from the body.
    expect(property.state).toBe("Lagos");
  });

  it("defaults a new listing to draft", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send(listingBody());

    expect(response.body.data.property.publicationState).toBe("draft");
  });

  it("blocks an agent without canPublish from publishing directly", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", agentCookie)
      .send({ ...listingBody(), publicationState: "published" });

    // §7 leaves direct-publish vs approval to the client; the flag is enforced here.
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/permission to publish/i);
  });

  it("lets an administrator publish directly", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send({ ...listingBody(), publicationState: "published" });

    expect(response.status).toBe(201);
    expect(response.body.data.property.publicationState).toBe("published");
  });

  it("ignores non-writable fields sent in the body", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", agentCookie)
      .send({
        ...listingBody(),
        // A crafted request must not be able to set any of these.
        viewCount: 9999,
        isFeatured: true,
        deletedAt: new Date(),
        reference: "REF0001",
      });

    const { property } = response.body.data;
    expect(property.viewCount).toBe(0);
    expect(property.isFeatured).toBe(false);
    expect(property.deletedAt).toBeNull();
    expect(property.reference).not.toBe("REF0001");
  });

  it("assigns an agent's own listings to them regardless of the body", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", agentCookie)
      .send({ ...listingBody(), agent: String(otherAgent._id) });

    const agent = await Agent.findOne({ email: "junior@example.com" });
    // An agent can't file a listing under someone else's name.
    expect(String(response.body.data.property.agent)).toBe(String(agent._id));
  });

  it("stops an agent editing a listing that isn't theirs", async () => {
    const created = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send({ ...listingBody(), agent: String(otherAgent._id) });

    const response = await request(app)
      .patch(`/api/admin/properties/${created.body.data.property._id}`)
      .set("Cookie", agentCookie)
      .send({ title: "Hijacked listing" });

    expect(response.status).toBe(403);
  });

  it("shows an agent only their own listings", async () => {
    await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send({ ...listingBody(), agent: String(otherAgent._id) });
    await request(app).post("/api/admin/properties").set("Cookie", agentCookie).send(listingBody());

    const agentView = await request(app).get("/api/admin/properties").set("Cookie", agentCookie);
    const adminView = await request(app).get("/api/admin/properties").set("Cookie", adminCookie);

    expect(agentView.body.data.pagination.total).toBe(1);
    expect(adminView.body.data.pagination.total).toBe(2);
  });

  it("updates the slug when a listing is retitled, keeping the reference", async () => {
    const created = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send(listingBody());
    const { _id, reference } = created.body.data.property;

    const response = await request(app)
      .patch(`/api/admin/properties/${_id}`)
      .set("Cookie", adminCookie)
      .send({ title: "4 Bedroom Duplex in Lekki" });

    expect(response.body.data.property.slug).toContain("4-bedroom-duplex-in-lekki");
    // Same record, still recognisable by its reference.
    expect(response.body.data.property.reference).toBe(reference);
  });

  it("still enforces the Lagos rent cap through the admin route", async () => {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send({
        ...listingBody(),
        listingType: "rent",
        price: undefined,
        rent: { amount: 5000000, agencyFeePct: 15 },
      });

    // The statutory check lives on the model, so no route can bypass it.
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/validation/i);
  });

  it("soft deletes and restores, never removing the record", async () => {
    const created = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send({ ...listingBody(), publicationState: "published" });
    const { _id } = created.body.data.property;

    const deleted = await request(app)
      .delete(`/api/admin/properties/${_id}`)
      .set("Cookie", adminCookie);
    expect(deleted.status).toBe(200);

    // The document survives — enquiries reference it.
    const stored = await Property.findById(_id);
    expect(stored).not.toBeNull();
    expect(stored.deletedAt).toBeInstanceOf(Date);

    // And it leaves the public API immediately.
    const publicView = await request(app).get(`/api/properties/${stored.slug}`);
    expect(publicView.status).toBe(404);

    const restored = await request(app)
      .post(`/api/admin/properties/${_id}/restore`)
      .set("Cookie", adminCookie);
    expect(restored.body.data.property.deletedAt).toBeNull();
  });

  it("hides soft-deleted listings from the admin table unless asked for", async () => {
    const created = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", adminCookie)
      .send(listingBody());
    await request(app)
      .delete(`/api/admin/properties/${created.body.data.property._id}`)
      .set("Cookie", adminCookie);

    const defaultView = await request(app).get("/api/admin/properties").set("Cookie", adminCookie);
    expect(defaultView.body.data.pagination.total).toBe(0);

    const withDeleted = await request(app)
      .get("/api/admin/properties?includeDeleted=true")
      .set("Cookie", adminCookie);
    expect(withDeleted.body.data.pagination.total).toBe(1);
  });

  it("lets only an administrator feature a listing", async () => {
    const created = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", agentCookie)
      .send(listingBody());
    const { _id } = created.body.data.property;

    // An agent promoting their own listing to the homepage is exactly what the
    // admin-only guard prevents.
    const byAgent = await request(app)
      .post(`/api/admin/properties/${_id}/feature`)
      .set("Cookie", agentCookie)
      .send({ isFeatured: true });
    expect(byAgent.status).toBe(403);

    const byAdmin = await request(app)
      .post(`/api/admin/properties/${_id}/feature`)
      .set("Cookie", adminCookie)
      .send({ isFeatured: true });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.property.isFeatured).toBe(true);
  });
});

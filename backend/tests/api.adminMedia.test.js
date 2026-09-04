import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";

/**
 * Admin media endpoints.
 *
 * Cloudinary is mocked throughout: these tests are about who may upload where and
 * what the API is willing to believe from the client, not about the SDK. The
 * important cases are the ones where trusting the request body would let a caller
 * attach an asset that is not theirs.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";

// Hoisted so the vi.mock factory below can close over it — vi.mock is lifted above
// every import, so a plain const would not exist yet when the factory runs.
const cloudinaryMock = vi.hoisted(() => ({
  api: { resource: vi.fn() },
  uploader: { destroy: vi.fn() },
  config: vi.fn(),
  utils: { api_sign_request: vi.fn(() => "signed") },
}));

vi.mock("../config/cloudinary.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: cloudinaryMock,
    // The signature path still needs a real-looking SDK, but must not reach the
    // network; the mock's api_sign_request returns a stable string.
    configureCloudinary: () => cloudinaryMock,
  };
});

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

/**
 * The shape Cloudinary's Admin API returns for one uploaded image.
 *
 * Takes: publicId (string).
 * Returns: a resource object with a deliberately large width/height, so a test can
 *          tell a Cloudinary-sourced dimension from a client-supplied one.
 */
function cloudinaryResource(publicId) {
  return {
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.jpg`,
    width: 4032,
    height: 3024,
    bytes: 2_400_000,
    format: "jpg",
    resource_type: "image",
    eager: [
      {
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_400,h_300/${publicId}.jpg`,
      },
    ],
  };
}

describe("POST /api/admin/properties/:id/media/signature", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    vi.clearAllMocks();
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

  it("requires a session", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app).post(
      `/api/admin/properties/${property._id}/media/signature`
    );

    expect(response.status).toBe(401);
  });

  it("returns a signature scoped to the listing's own folder", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media/signature`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.folder).toBe(`properties/${property.reference}`);
    expect(response.body.data.uploadUrl).toContain("/v1_1/test-cloud/image/upload");
    expect(response.body.data.signature).toBeTruthy();
    expect(response.body.data.apiKey).toBe("test-key");
  });

  it("never leaks the API secret to the browser", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media/signature`)
      .set("Cookie", adminCookie);

    expect(JSON.stringify(response.body)).not.toContain("test-secret");
  });

  it("refuses a listing the agent does not own, with 403 not 404", async () => {
    const property = await createListing(adminCookie, { agent: String(otherAgent._id) });

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media/signature`)
      .set("Cookie", agentCookie);

    // 403, not 404: these are authenticated colleagues, and pretending the record
    // does not exist is the public surface's rule, not this one's.
    expect(response.status).toBe(403);
  });

  it("404s for a listing that does not exist", async () => {
    const response = await request(app)
      .post("/api/admin/properties/64b7f0000000000000000000/media/signature")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });

  it("503s when Cloudinary is not configured, without taking the API down", async () => {
    const property = await createListing(adminCookie);
    const secret = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;

    try {
      const response = await request(app)
        .post(`/api/admin/properties/${property._id}/media/signature`)
        .set("Cookie", adminCookie);

      expect(response.status).toBe(503);

      // The rest of the admin surface is unaffected — an unconfigured Cloudinary
      // must not stop anyone editing a listing.
      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);
      expect(listing.status).toBe(200);
    } finally {
      process.env.CLOUDINARY_API_SECRET = secret;
    }
  });
});

describe("POST /api/admin/properties/:id/media", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    vi.clearAllMocks();
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

  const listingBody = () => ({
    title: "3 Bedroom Flat in Lekki",
    listingType: "sale",
    propertyType: "apartment",
    location: String(location._id),
    landmark: "Opposite Circle Mall",
    price: { amount: 95000000, currency: "NGN" },
  });

  async function createListing(cookie, overrides = {}) {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", cookie)
      .send({ ...listingBody(), ...overrides });

    return response.body.data.property;
  }

  it("registers an asset that sits in the listing's folder", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId, alt: "Front elevation" });

    expect(response.status).toBe(201);
    expect(response.body.data.media.publicId).toBe(publicId);
    expect(response.body.data.media.alt).toBe("Front elevation");
    expect(response.body.data.media.width).toBe(4032);
    expect(response.body.data.media.height).toBe(3024);
    expect(response.body.data.media.thumbnailUrl).toContain("c_fill,w_400,h_300");
    expect(response.body.data.media.displayOrder).toBe(0);
  });

  it("takes url and dimensions from Cloudinary, never from the request body", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({
        publicId,
        // All three are attacker-controlled if believed: a foreign url makes the
        // record point anywhere, and false dimensions poison the layout-shift
        // reservation on every page the image appears on.
        url: "https://evil.example.com/tracker.gif",
        width: 1,
        height: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.media.url).toContain("res.cloudinary.com");
    expect(response.body.data.media.url).not.toContain("evil.example.com");
    expect(response.body.data.media.width).toBe(4032);
    expect(response.body.data.media.height).toBe(3024);
  });

  it("rejects a publicId belonging to another listing", async () => {
    const property = await createListing(adminCookie);
    const foreign = "properties/REF9999/stolen";
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(foreign));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId: foreign });

    expect(response.status).toBe(400);
    // The folder check must run before the lookup, so a probe cannot be used to
    // discover which public ids exist in the account.
    expect(cloudinaryMock.api.resource).not.toHaveBeenCalled();
  });

  it("rejects a publicId outside the properties folder entirely", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId: "logos/agency-watermark" });

    expect(response.status).toBe(400);
  });

  it("rejects a missing publicId", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
  });

  it("404s when Cloudinary has no such asset", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/missing`;
    cloudinaryMock.api.resource.mockRejectedValue({ http_code: 404 });

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    expect(response.status).toBe(404);
  });

  it("502s, without leaking SDK detail, when Cloudinary cannot be reached", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockRejectedValue(
      new Error("connect ETIMEDOUT 10.0.0.1:443")
    );

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    expect(response.status).toBe(502);
    expect(response.body.message).not.toContain("ETIMEDOUT");
  });

  it("appends to the end of the gallery", async () => {
    const property = await createListing(adminCookie);

    for (const name of ["first", "second"]) {
      const publicId = `properties/${property.reference}/${name}`;
      cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));
      await request(app)
        .post(`/api/admin/properties/${property._id}/media`)
        .set("Cookie", adminCookie)
        .send({ publicId });
    }

    const listing = await request(app)
      .get(`/api/admin/properties/${property._id}`)
      .set("Cookie", adminCookie);

    expect(listing.body.data.media.map((item) => item.displayOrder)).toEqual([0, 1]);
  });

  it("rejects registering the same asset twice", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    const second = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    // publicId is unique-indexed; the error handler already maps 11000 to 409.
    expect(second.status).toBe(409);
  });

  it("refuses a listing the agent does not own", async () => {
    const property = await createListing(adminCookie, { agent: String(otherAgent._id) });
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", agentCookie)
      .send({ publicId });

    expect(response.status).toBe(403);
  });
});

describe("gallery management", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    location = await Location.findOne({ state: "Lagos" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
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

  const listingBody = () => ({
    title: "3 Bedroom Flat in Lekki",
    listingType: "sale",
    propertyType: "apartment",
    location: String(location._id),
    landmark: "Opposite Circle Mall",
    price: { amount: 95000000, currency: "NGN" },
  });

  async function createListing(cookie, overrides = {}) {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", cookie)
      .send({ ...listingBody(), ...overrides });

    return response.body.data.property;
  }

  /**
   * Creates a listing with `count` registered images.
   *
   * Takes: cookie (string), count (number), overrides (object).
   * Returns: a promise resolving to { property, media } — media in display order.
   */
  async function listingWithMedia(cookie, count = 3, overrides = {}) {
    const property = await createListing(cookie, overrides);
    const media = [];

    for (let index = 0; index < count; index += 1) {
      const publicId = `properties/${property.reference}/image-${index}`;
      cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

      const response = await request(app)
        .post(`/api/admin/properties/${property._id}/media`)
        .set("Cookie", cookie)
        .send({ publicId });

      media.push(response.body.data.media);
    }

    return { property, media };
  }

  describe("PATCH /media/order", () => {
    it("rewrites displayOrder to match the submitted order", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 3);
      const reversed = [media[2]._id, media[1]._id, media[0]._id];

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: reversed });

      expect(response.status).toBe(200);
      expect(response.body.data.media.map((item) => String(item._id))).toEqual(
        reversed.map(String)
      );
      expect(response.body.data.media.map((item) => item.displayOrder)).toEqual([
        0, 1, 2,
      ]);
    });

    it("rejects a partial list", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 3);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: [media[0]._id, media[1]._id] });

      // A partial list would leave the omitted image with a stale displayOrder,
      // silently colliding with one of the rewritten ones.
      expect(response.status).toBe(400);
    });

    it("rejects a duplicated id", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: [media[0]._id, media[0]._id] });

      expect(response.status).toBe(400);
    });

    it("rejects an id belonging to another listing", async () => {
      const mine = await listingWithMedia(adminCookie, 2);
      const theirs = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(`/api/admin/properties/${mine.property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: [mine.media[0]._id, theirs.media[0]._id] });

      expect(response.status).toBe(400);
    });

    it("refuses a listing the agent does not own", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2, {
        agent: String(otherAgent._id),
      });

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", agentCookie)
        .send({ ids: [media[1]._id, media[0]._id] });

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /media/:mediaId", () => {
    it("updates alt text", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie)
        .send({ alt: "Rear garden at dusk" });

      expect(response.status).toBe(200);
      expect(response.body.data.media.alt).toBe("Rear garden at dusk");
    });

    it("ignores every field but alt", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie)
        .send({
          alt: "Rear garden",
          url: "https://evil.example.com/tracker.gif",
          publicId: "properties/REF9999/stolen",
          displayOrder: 99,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.media.url).toContain("res.cloudinary.com");
      expect(response.body.data.media.publicId).toBe(media[0].publicId);
      expect(response.body.data.media.displayOrder).toBe(0);
    });

    it("404s for an image on another listing", async () => {
      const mine = await listingWithMedia(adminCookie, 1);
      const theirs = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(
          `/api/admin/properties/${mine.property._id}/media/${theirs.media[0]._id}`
        )
        .set("Cookie", adminCookie)
        .send({ alt: "Not mine" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /media/:mediaId", () => {
    it("destroys the Cloudinary asset before dropping the record", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "ok" });

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[1]._id}`)
        .set("Cookie", adminCookie);

      expect(response.status).toBe(200);
      // An orphaned Cloudinary asset bills forever and nothing points at it; an
      // orphaned database row is visible and fixable. So the remote goes first.
      expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(
        media[1].publicId,
        expect.anything()
      );

      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);
      expect(listing.body.data.media).toHaveLength(1);
    });

    it("clears the listing's cover when the deleted image was it", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "ok" });

      await request(app)
        .patch(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie)
        .send({ coverImage: media[0]._id });

      await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie);

      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);

      // A dangling cover reference makes coverImageOf fall through to the grey
      // placeholder with nothing in the UI explaining why.
      expect(listing.body.data.property.coverImage ?? null).toBeNull();
    });

    it("leaves the cover alone when a different image is deleted", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "ok" });

      await request(app)
        .patch(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie)
        .send({ coverImage: media[0]._id });

      await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[1]._id}`)
        .set("Cookie", adminCookie);

      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);

      expect(String(listing.body.data.property.coverImage._id)).toBe(
        String(media[0]._id)
      );
    });

    it("still removes the record when Cloudinary reports the asset already gone", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "not found" });

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie);

      // Otherwise a half-deleted asset is permanently undeletable from the UI.
      expect(response.status).toBe(200);
    });

    it("keeps the record when Cloudinary deletion genuinely fails", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);
      cloudinaryMock.uploader.destroy.mockRejectedValue(new Error("network down"));

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie);

      expect(response.status).toBe(502);

      // Dropping the row first would orphan a billable asset with nothing left
      // pointing at it, so the image must still be listed.
      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);
      expect(listing.body.data.media).toHaveLength(1);
    });

    it("refuses a listing the agent does not own", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1, {
        agent: String(otherAgent._id),
      });

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", agentCookie);

      expect(response.status).toBe(403);
    });
  });
});

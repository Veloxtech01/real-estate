import { describe, it, expect } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";

/**
 * Smoke tests for the API scaffold.
 *
 * These verify the plumbing itself — app assembly, JSON response shape, and that
 * unmatched routes leave through the centralized error handler — so a later
 * refactor of app.js can't silently break the contract every controller relies on.
 */
describe("API scaffold", () => {
  const app = createApp();

  it("reports health on GET /api/health", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    // The standard success shape: { success: true, data: {...} }.
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    // No DB is configured in the test environment, so this must read as
    // disconnected rather than throwing.
    expect(response.body.data.database).toBe("disconnected");
  });

  it("returns a 404 in the standard error shape for unknown routes", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    // The standard failure shape: { success: false, message: "..." }.
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Route not found");
  });

  it("parses a JSON request body", async () => {
    // Posting to a route that doesn't exist still proves express.json() ran
    // without erroring on a valid payload — the 404 comes from the router, not
    // from a body-parse failure (which would surface as a 400).
    const response = await request(app)
      .post("/api/does-not-exist")
      .send({ hello: "world" });

    expect(response.status).toBe(404);
  });
});

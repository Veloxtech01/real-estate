import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Settings from "../model/settingsModel.js";

/**
 * Admin settings API (§9, §11) — administrator-only read/write over the Settings
 * singleton.
 *
 * The cases that matter: an agent must never reach any of this, a theme/aiSearch
 * partial update must not clobber the rest of that sub-object, currentSpendUsd must
 * never be writable even when present in the body, and invalid fields must 400 with
 * dotted-path details the admin form can map onto an input.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** Logs in and returns the session cookie. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Admin settings API", () => {
  let adminCookie;
  let agentCookie;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    const Agent = (await import("../model/agentModel.js")).default;
    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  describe("role enforcement", () => {
    it("requires a session on every route", async () => {
      expect((await request(app).get("/api/admin/settings")).status).toBe(401);
      expect((await request(app).patch("/api/admin/settings").send({})).status).toBe(401);
    });

    it("403s an agent on every route", async () => {
      expect(
        (await request(app).get("/api/admin/settings").set("Cookie", agentCookie)).status,
      ).toBe(403);
      expect(
        (await request(app).patch("/api/admin/settings").set("Cookie", agentCookie).send({}))
          .status,
      ).toBe(403);
    });
  });

  describe("GET /api/admin/settings", () => {
    it("returns operational fields the public endpoint never sends", async () => {
      await Settings.get();
      await Settings.findOneAndUpdate(
        { key: "site" },
        { "aiSearch.currentSpendUsd": 12.5, "aiSearch.monthlySpendCapUsd": 50 },
      );

      const response = await request(app).get("/api/admin/settings").set("Cookie", adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.settings.aiSearch.currentSpendUsd).toBe(12.5);
      expect(response.body.data.settings.aiSearch.monthlySpendCapUsd).toBe(50);
    });
  });

  describe("PATCH /api/admin/settings", () => {
    it("updates a flat field", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ agencyName: "Renamed Agency" });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.agencyName).toBe("Renamed Agency");
    });

    it("rejects a blank agency name", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ agencyName: "   " });

      expect(response.status).toBe(400);
      expect(response.body.details.agencyName).toBeDefined();
    });

    it("rejects a malformed email", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(response.body.details.email).toBeDefined();
    });

    it("merges a partial theme.colors update without dropping other theme fields", async () => {
      await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ theme: { fontHeading: "Playfair Display", colors: { accent: "#c6a15b" } } });

      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ theme: { colors: { ink: "#0d1b2a" } } });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.theme.fontHeading).toBe("Playfair Display");
      expect(response.body.data.settings.theme.colors.accent).toBe("#c6a15b");
      expect(response.body.data.settings.theme.colors.ink).toBe("#0d1b2a");
    });

    it("rejects a malformed hex color", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ theme: { colors: { accent: "not-a-color" } } });

      expect(response.status).toBe(400);
      expect(response.body.details["theme.colors.accent"]).toBeDefined();
    });

    it("merges a partial aiSearch update without dropping timeoutMs", async () => {
      await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ aiSearch: { timeoutMs: 1500 } });

      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ aiSearch: { enabled: true, monthlySpendCapUsd: 25 } });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.aiSearch.timeoutMs).toBe(1500);
      expect(response.body.data.settings.aiSearch.enabled).toBe(true);
      expect(response.body.data.settings.aiSearch.monthlySpendCapUsd).toBe(25);
    });

    it("never writes currentSpendUsd even when present in the body", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ aiSearch: { currentSpendUsd: 999 } });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.aiSearch.currentSpendUsd).not.toBe(999);
    });

    it("rejects a negative spend cap", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ aiSearch: { monthlySpendCapUsd: -5 } });

      expect(response.status).toBe(400);
      expect(response.body.details["aiSearch.monthlySpendCapUsd"]).toBeDefined();
    });

    it("doesn't 500 on a request with no JSON body", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie);

      expect(response.status).toBe(200);
    });

    it("drops unlisted fields silently", async () => {
      const response = await request(app)
        .patch("/api/admin/settings")
        .set("Cookie", adminCookie)
        .send({ key: "not-site", _id: "000000000000000000000000" });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.key).toBe("site");
    });
  });
});

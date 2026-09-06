import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";

/**
 * Admin staff management (§7) — administrator-only CRUD over agentModel.
 *
 * The cases that matter: an agent must never reach any of this, deactivate/demote
 * guards must hold against self-action, and a password must never leak back out.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** Logs in and returns the session cookie. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Admin staff API", () => {
  let adminCookie;
  let agentCookie;
  let admin;
  let agent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    admin = await Agent.findOne({ role: "administrator" });

    agent = await Agent.create({
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
      expect((await request(app).get("/api/admin/staff")).status).toBe(401);
      expect((await request(app).get(`/api/admin/staff/${agent._id}`)).status).toBe(401);
      expect((await request(app).post("/api/admin/staff").send({})).status).toBe(401);
      expect((await request(app).patch(`/api/admin/staff/${agent._id}`).send({})).status).toBe(
        401,
      );
    });

    it("403s an agent on every route", async () => {
      expect(
        (await request(app).get("/api/admin/staff").set("Cookie", agentCookie)).status,
      ).toBe(403);
      expect(
        (await request(app).get(`/api/admin/staff/${agent._id}`).set("Cookie", agentCookie))
          .status,
      ).toBe(403);
      expect(
        (await request(app).post("/api/admin/staff").set("Cookie", agentCookie).send({})).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/admin/staff/${agent._id}`)
            .set("Cookie", agentCookie)
            .send({})
        ).status,
      ).toBe(403);
    });
  });

  describe("GET /api/admin/staff", () => {
    it("includes inactive accounts, unlike the public roster", async () => {
      await Agent.create({
        name: "Former Agent",
        slug: "former-agent",
        email: "former@example.com",
        password: "agent-password",
        role: "agent",
        isActive: false,
      });

      const response = await request(app).get("/api/admin/staff").set("Cookie", adminCookie);

      const names = response.body.data.staff.map((s) => s.name);
      expect(names).toContain("Former Agent");
    });

    it("never returns a password", async () => {
      const response = await request(app).get("/api/admin/staff").set("Cookie", adminCookie);

      expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    });
  });

  describe("POST /api/admin/staff", () => {
    const validBody = () => ({
      name: "New Consultant",
      email: "new-consultant@example.com",
      password: "supersecret",
      role: "agent",
    });

    it("creates an account and hashes the password", async () => {
      const response = await request(app)
        .post("/api/admin/staff")
        .set("Cookie", adminCookie)
        .send(validBody());

      expect(response.status).toBe(201);
      expect(response.body.data.staffMember.password).toBeUndefined();

      const stored = await Agent.findOne({ email: "new-consultant@example.com" }).select(
        "+password",
      );
      expect(stored.password).not.toBe("supersecret");
      expect(stored.password).toMatch(/^\$2[aby]\$/);
    });

    it("rejects a password shorter than 8 characters", async () => {
      const response = await request(app)
        .post("/api/admin/staff")
        .set("Cookie", adminCookie)
        .send({ ...validBody(), password: "short" });

      expect(response.status).toBe(400);
      expect(response.body.details.password).toBeDefined();
    });

    it("rejects a duplicate email with 409", async () => {
      const response = await request(app)
        .post("/api/admin/staff")
        .set("Cookie", adminCookie)
        .send({ ...validBody(), email: "junior@example.com" });

      expect(response.status).toBe(409);
    });

    it("gives two same-named agents distinct slugs", async () => {
      await request(app).post("/api/admin/staff").set("Cookie", adminCookie).send(validBody());

      const second = await request(app)
        .post("/api/admin/staff")
        .set("Cookie", adminCookie)
        .send({ ...validBody(), email: "second-consultant@example.com" });

      const both = await Agent.find({ name: "New Consultant" }).select("slug");
      const slugs = both.map((a) => a.slug).sort();
      expect(slugs).toEqual(["new-consultant", "new-consultant-2"]);
      expect(second.body.data.staffMember.slug).toBe("new-consultant-2");
    });
  });

  describe("PATCH /api/admin/staff/:id", () => {
    it("deactivates an agent", async () => {
      const response = await request(app)
        .patch(`/api/admin/staff/${agent._id}`)
        .set("Cookie", adminCookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.data.staffMember.isActive).toBe(false);
    });

    it("resets a password without leaking it back", async () => {
      const response = await request(app)
        .patch(`/api/admin/staff/${agent._id}`)
        .set("Cookie", adminCookie)
        .send({ password: "brand-new-password" });

      expect(response.status).toBe(200);
      expect(response.body.data.staffMember.password).toBeUndefined();

      const stored = await Agent.findById(agent._id).select("+password");
      expect(await stored.comparePassword("brand-new-password")).toBe(true);
    });

    it("re-slugs when the name changes", async () => {
      const response = await request(app)
        .patch(`/api/admin/staff/${agent._id}`)
        .set("Cookie", adminCookie)
        .send({ name: "Renamed Agent" });

      expect(response.body.data.staffMember.slug).toBe("renamed-agent");
    });

    it("prevents an administrator from deactivating their own account", async () => {
      const response = await request(app)
        .patch(`/api/admin/staff/${admin._id}`)
        .set("Cookie", adminCookie)
        .send({ isActive: false });

      expect(response.status).toBe(400);

      const stillActive = await Agent.findById(admin._id).select("isActive");
      expect(stillActive.isActive).toBe(true);
    });

    it("prevents an administrator from demoting their own account", async () => {
      const response = await request(app)
        .patch(`/api/admin/staff/${admin._id}`)
        .set("Cookie", adminCookie)
        .send({ role: "agent" });

      expect(response.status).toBe(400);

      const stillAdmin = await Agent.findById(admin._id).select("role");
      expect(stillAdmin.role).toBe("administrator");
    });

    it("still lets an administrator deactivate a colleague", async () => {
      const response = await request(app)
        .patch(`/api/admin/staff/${agent._id}`)
        .set("Cookie", adminCookie)
        .send({ isActive: false });

      expect(response.status).toBe(200);
    });
  });

  describe("regression: public agents endpoint", () => {
    it("still excludes inactive staff even though the admin roster includes them", async () => {
      await Agent.create({
        name: "Former Agent",
        slug: "former-agent",
        email: "former@example.com",
        password: "agent-password",
        role: "agent",
        isActive: false,
        isPublic: true,
      });

      const response = await request(app).get("/api/agents");

      const names = response.body.data.agents.map((a) => a.name);
      expect(names).not.toContain("Former Agent");
    });
  });
});

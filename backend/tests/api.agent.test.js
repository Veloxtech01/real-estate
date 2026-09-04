import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import Agent from "../model/agentModel.js";

/**
 * Public agent API — the §3 "meet the team" directory and referral pages.
 *
 * Each test creates its own agents rather than sharing a seeded fixture: the
 * roster here is small, so per-test isolation is cheap and avoids tests
 * depending on each other's data (same style as agent.model.test.js).
 */
describe("Public agent API", () => {
  const app = createApp();

  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  /** Creates an agent with sane defaults, overridable per test. */
  async function createAgent(overrides = {}) {
    return Agent.create({
      name: "Adaeze Okonkwo",
      slug: "adaeze-okonkwo",
      email: "adaeze@example.com",
      password: "supersecret",
      phone: "+2348012345678",
      whatsapp: "2348012345678",
      position: "Senior Sales Consultant",
      isPublic: true,
      isActive: true,
      ...overrides,
    });
  }

  it("lists only public, active agents", async () => {
    await createAgent();
    await createAgent({
      name: "Private Agent",
      slug: "private-agent",
      email: "private@example.com",
      isPublic: false,
    });
    await createAgent({
      name: "Inactive Agent",
      slug: "inactive-agent",
      email: "inactive@example.com",
      isActive: false,
    });

    const response = await request(app).get("/api/agents");

    expect(response.status).toBe(200);
    expect(response.body.data.agents).toHaveLength(1);
    expect(response.body.data.agents[0].name).toBe("Adaeze Okonkwo");
  });

  it("never exposes email or password on the list or detail endpoint", async () => {
    await createAgent();

    const list = await request(app).get("/api/agents");
    expect(list.body.data.agents[0].email).toBeUndefined();
    expect(list.body.data.agents[0].password).toBeUndefined();

    const detail = await request(app).get("/api/agents/adaeze-okonkwo");
    expect(detail.body.data.agent.email).toBeUndefined();
    expect(detail.body.data.agent.password).toBeUndefined();
  });

  it("returns one agent by slug with name, position and contact numbers", async () => {
    await createAgent();

    const response = await request(app).get("/api/agents/adaeze-okonkwo");

    expect(response.status).toBe(200);
    expect(response.body.data.agent).toMatchObject({
      name: "Adaeze Okonkwo",
      slug: "adaeze-okonkwo",
      position: "Senior Sales Consultant",
      phone: "+2348012345678",
    });
  });

  it("404s identically for a private agent, an inactive agent, and an unknown slug", async () => {
    await createAgent({
      name: "Private Agent",
      slug: "private-agent",
      email: "private@example.com",
      isPublic: false,
    });
    await createAgent({
      name: "Inactive Agent",
      slug: "inactive-agent",
      email: "inactive@example.com",
      isActive: false,
    });

    const privateResponse = await request(app).get("/api/agents/private-agent");
    const inactiveResponse = await request(app).get("/api/agents/inactive-agent");
    const unknownResponse = await request(app).get("/api/agents/does-not-exist");

    expect(privateResponse.status).toBe(404);
    expect(inactiveResponse.status).toBe(404);
    expect(unknownResponse.status).toBe(404);
  });
});

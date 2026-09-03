import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import Agent from "../model/agentModel.js";
import { toSquareMetres, getStateRentRules } from "../utils/constants.js";

/**
 * Agent model + domain constant tests.
 *
 * The agent tests cover credential handling, where a mistake is a security bug
 * rather than a display bug. The constants tests cover the land-unit conversion,
 * where a mistake silently misstates the size of every plot on the site.
 */
describe("Agent model", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  /** Baseline valid staff account. */
  const baseAgent = {
    name: "Adaeze Okonkwo",
    slug: "adaeze-okonkwo",
    email: "Adaeze@Example.com",
    password: "supersecret",
  };

  it("hashes the password on save and never stores it in plaintext", async () => {
    const agent = await Agent.create(baseAgent);

    // The document holds a bcrypt hash, not the submitted password.
    const stored = await Agent.findById(agent._id).select("+password");
    expect(stored.password).not.toBe("supersecret");
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it("excludes the password from queries and JSON by default", async () => {
    const created = await Agent.create(baseAgent);

    const found = await Agent.findById(created._id);
    expect(found.password).toBeUndefined();

    // Even when explicitly selected, it must not survive serialisation.
    const withPassword = await Agent.findById(created._id).select("+password");
    expect(JSON.parse(JSON.stringify(withPassword)).password).toBeUndefined();
  });

  it("verifies a correct password and rejects a wrong one", async () => {
    const created = await Agent.create(baseAgent);
    const agent = await Agent.findById(created._id).select("+password");

    expect(await agent.comparePassword("supersecret")).toBe(true);
    expect(await agent.comparePassword("not-the-password")).toBe(false);
  });

  it("does not rehash the password when an unrelated field changes", async () => {
    const created = await Agent.create(baseAgent);
    const before = (await Agent.findById(created._id).select("+password")).password;

    const agent = await Agent.findById(created._id);
    agent.position = "Senior Sales Consultant";
    await agent.save();

    // Rehashing here would invalidate the account's existing credentials.
    const after = (await Agent.findById(created._id).select("+password")).password;
    expect(after).toBe(before);
  });

  it("lowercases the email so one address cannot register twice", async () => {
    const agent = await Agent.create(baseAgent);
    expect(agent.email).toBe("adaeze@example.com");
  });

  it("defaults to the agent role that cannot publish directly", async () => {
    const agent = await Agent.create(baseAgent);

    // §7 leaves direct-publish vs admin-approval to the client, so the default is
    // the safer of the two.
    expect(agent.role).toBe("agent");
    expect(agent.canPublish).toBe(false);
  });
});

describe("Domain constants", () => {
  it("converts land units to square metres, the canonical stored unit", () => {
    expect(toSquareMetres(1, "sqm")).toBe(1);
    expect(toSquareMetres(1, "plot")).toBe(648);
    // A plot is materially smaller in parts of Lagos — which is exactly why nothing
    // is stored in plots.
    expect(toSquareMetres(1, "plot_lagos")).toBe(464);
    expect(toSquareMetres(1, "hectare")).toBe(10000);
    expect(toSquareMetres(2, "acre")).toBe(8093.72);
  });

  it("throws on an unknown land unit rather than assuming square metres", () => {
    expect(() => toSquareMetres(1, "furlong")).toThrow(/unknown land unit/i);
  });

  it("returns Lagos statutory rent limits, and permissive defaults elsewhere", () => {
    expect(getStateRentRules("Lagos")).toEqual({
      maxAgencyFeePct: 10,
      maxAdvanceYears: 1,
    });

    // Absent a known statutory cap we don't invent one.
    expect(getStateRentRules("Ogun").maxAgencyFeePct).toBe(100);
  });
});

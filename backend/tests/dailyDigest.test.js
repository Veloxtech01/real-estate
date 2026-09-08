import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import Property from "../model/propertyModel.js";
import Enquiry from "../model/enquiryModel.js";
import Settings from "../model/settingsModel.js";

/**
 * §4.3 daily digest — recipient selection, the 24h window, and the no-op-on-empty
 * rule. Resend is mocked so these tests assert on send *count* and *recipients*,
 * never on real network calls — same pattern as api.adminMedia.test.js's Cloudinary
 * mock.
 */

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));

vi.mock("../utils/emailService.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: sendEmailMock };
});

const { getDigestEnquiries, sendDailyDigest } = await import("../utils/dailyDigest.js");

beforeAll(connectTestDB);
beforeEach(async () => {
  await clearTestDB();
  sendEmailMock.mockClear();
});
afterAll(closeTestDB);

/**
 * Creates a minimal valid Agent document.
 *
 * Takes: overrides (object) — fields to override the defaults.
 * Returns: a promise resolving to the saved Agent.
 */
function makeAgent(overrides = {}) {
  return Agent.create({
    name: "Test Staff",
    slug: `test-staff-${Math.random().toString(36).slice(2)}`,
    email: `staff-${Math.random().toString(36).slice(2)}@example.test`,
    password: "password123",
    role: "agent",
    isActive: true,
    ...overrides,
  });
}

/**
 * Creates a minimal valid Enquiry document.
 *
 * Takes: overrides (object).
 * Returns: a promise resolving to the saved Enquiry.
 */
function makeEnquiry(overrides = {}) {
  return Enquiry.create({
    name: "Prospect",
    phone: "08012345678",
    type: "general",
    ...overrides,
  });
}

describe("getDigestEnquiries", () => {
  it("returns only enquiries created since the given date, newest first", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // createdAt is immutable under Mongoose's timestamps:true, so backdating it for
    // this test has to bypass Mongoose and go through the raw driver collection.
    const old = await makeEnquiry({ name: "Old lead" });
    await Enquiry.collection.updateOne(
      { _id: old._id },
      { $set: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) } }
    );

    await makeEnquiry({ name: "Recent first" });
    await makeEnquiry({ name: "Recent second" });

    const results = await getDigestEnquiries(since);

    expect(results.map((e) => e.name)).toEqual(["Recent second", "Recent first"]);
  });

  it("resolves a property label from the linked listing's title/reference", async () => {
    const agent = await makeAgent();
    const location = await Location.create({
      name: "Lekki Phase 1",
      slug: `lekki-phase-1-${Math.random().toString(36).slice(2)}`,
      state: "Lagos",
    });

    const property = await Property.create({
      title: "3 Bedroom Duplex",
      reference: "REF1042",
      slug: "3-bedroom-duplex-ref1042",
      listingType: "sale",
      propertyType: "duplex",
      agent: agent._id,
      location: location._id,
      state: "Lagos",
      landmark: "Opposite Shoprite, Circle Mall",
      price: { amount: 250_000_000, currency: "NGN" },
    });

    await makeEnquiry({ name: "Ada", property: property._id });

    const [result] = await getDigestEnquiries(new Date(Date.now() - 60 * 60 * 1000));

    expect(result.propertyLabel).toBe("3 Bedroom Duplex (REF1042)");
  });

  it("falls back to requirement.location, then to the type, when there is no property", async () => {
    await makeEnquiry({
      name: "Bola",
      type: "list_property",
      requirement: { location: "Yaba, Lagos" },
    });
    await makeEnquiry({ name: "Chika", type: "valuation_request" });

    const results = await getDigestEnquiries(new Date(Date.now() - 60 * 60 * 1000));

    const bola = results.find((e) => e.name === "Bola");
    const chika = results.find((e) => e.name === "Chika");

    expect(bola.propertyLabel).toBe("Yaba, Lagos");
    expect(chika.propertyLabel).toBe("valuation_request");
  });
});

describe("sendDailyDigest", () => {
  it("sends no email when there are no qualifying enquiries", async () => {
    await makeAgent({ role: "administrator" });

    await sendDailyDigest();

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends exactly one email per active administrator, and none to agents or inactive admins", async () => {
    await Settings.get();
    const admin1 = await makeAgent({ role: "administrator", name: "Admin One" });
    const admin2 = await makeAgent({ role: "administrator", name: "Admin Two" });
    await makeAgent({ role: "administrator", name: "Inactive Admin", isActive: false });
    await makeAgent({ role: "agent", name: "Regular Agent" });

    await makeEnquiry({ name: "New Lead" });

    await sendDailyDigest();

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const recipients = sendEmailMock.mock.calls.map((call) => call[0].to);
    expect(recipients).toEqual(expect.arrayContaining([admin1.email, admin2.email]));
  });

  it("does not stop other sends when one admin's email fails", async () => {
    await makeAgent({ role: "administrator", name: "Admin One" });
    await makeAgent({ role: "administrator", name: "Admin Two" });
    await makeEnquiry({ name: "New Lead" });

    sendEmailMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ sent: true });

    await expect(sendDailyDigest()).resolves.not.toThrow();
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
});

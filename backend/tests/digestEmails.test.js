import { describe, it, expect } from "vitest";
import { adminDailyDigest } from "../emails/digestEmails.js";

/**
 * Template test for the admin daily-digest email (§4.3).
 *
 * Pure function, no DB/network involved — same "template test" shape the other
 * email files would use if they had one, just asserting on the returned HTML string.
 */

describe("adminDailyDigest", () => {
  const baseArgs = {
    agencyName: "Test Agency",
    clientUrl: "https://example.test",
  };

  it("pluralizes the subject for more than one enquiry", () => {
    const { subject } = adminDailyDigest({
      ...baseArgs,
      enquiries: [
        { _id: "1", name: "Ada", type: "property_enquiry", createdAt: new Date(), propertyLabel: "general enquiry" },
        { _id: "2", name: "Bola", type: "general", createdAt: new Date(), propertyLabel: "general enquiry" },
      ],
    });

    expect(subject).toBe("Daily digest: 2 new enquiries");
  });

  it("uses the singular for exactly one enquiry", () => {
    const { subject } = adminDailyDigest({
      ...baseArgs,
      enquiries: [
        { _id: "1", name: "Ada", type: "property_enquiry", createdAt: new Date(), propertyLabel: "general enquiry" },
      ],
    });

    expect(subject).toBe("Daily digest: 1 new enquiry");
  });

  it("links each enquiry to its admin inbox row via ?id=", () => {
    const { html } = adminDailyDigest({
      ...baseArgs,
      enquiries: [
        { _id: "abc123", name: "Ada", type: "property_enquiry", createdAt: new Date(), propertyLabel: "general enquiry" },
      ],
    });

    expect(html).toContain("https://example.test/admin/enquiries?id=abc123");
  });

  it("includes each enquiry's name and property/area label", () => {
    const { html } = adminDailyDigest({
      ...baseArgs,
      enquiries: [
        {
          _id: "1",
          name: "Chidinma Eze",
          type: "property_enquiry",
          createdAt: new Date(),
          propertyLabel: "3 Bedroom Duplex (REF1042)",
        },
      ],
    });

    expect(html).toContain("Chidinma Eze");
    expect(html).toContain("3 Bedroom Duplex (REF1042)");
  });

  it("HTML-escapes an untrusted enquiry name", () => {
    const { html } = adminDailyDigest({
      ...baseArgs,
      enquiries: [
        {
          _id: "1",
          name: '<script>alert("x")</script>',
          type: "general",
          createdAt: new Date(),
          propertyLabel: "general enquiry",
        },
      ],
    });

    expect(html).not.toContain("<script>alert(\"x\")</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

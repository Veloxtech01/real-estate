import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Upload signature scoping.
 *
 * A Cloudinary signature is a bearer capability: whatever it authorises, the browser
 * holding it can do. These tests pin the two things that keep it narrow — the folder
 * it is locked to, and the folder check that later rejects a publicId from anywhere
 * else. Both are pure functions, so no network and no database.
 */

const ENV = { ...process.env };

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("folderForListing", () => {
  it("gives each listing its own folder, keyed by reference", async () => {
    const { folderForListing } = await import("../utils/mediaSignature.js");

    expect(folderForListing("REF1042")).toBe("properties/REF1042");
  });

  it("refuses a reference that could escape the properties folder", async () => {
    const { folderForListing } = await import("../utils/mediaSignature.js");

    // A reference is server-generated, but path traversal in a folder name would
    // let one listing's signature write over another's assets.
    expect(() => folderForListing("../secrets")).toThrow();
    expect(() => folderForListing("REF/1042")).toThrow();
    expect(() => folderForListing("")).toThrow();
  });
});

describe("isInListingFolder", () => {
  it("accepts a publicId inside the listing's own folder", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    expect(isInListingFolder("properties/REF1042/abc123", "REF1042")).toBe(true);
  });

  it("rejects another listing's folder", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    expect(isInListingFolder("properties/REF9999/abc123", "REF1042")).toBe(false);
  });

  it("rejects a prefix that merely starts the same", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    // "properties/REF1042extra" starts with "properties/REF1042" as a string but is
    // a different folder — a naive startsWith would let it through.
    expect(isInListingFolder("properties/REF1042extra/abc", "REF1042")).toBe(false);
  });

  it("rejects a publicId outside properties/ entirely", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    expect(isInListingFolder("REF1042/abc123", "REF1042")).toBe(false);
    expect(isInListingFolder("logos/agency-watermark", "REF1042")).toBe(false);
  });
});

describe("buildUploadSignature", () => {
  it("locks the signature to the listing's folder and a format whitelist", async () => {
    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    const result = buildUploadSignature("REF1042");

    expect(result.folder).toBe("properties/REF1042");
    expect(result.cloudName).toBe("test-cloud");
    expect(result.apiKey).toBe("test-key");
    expect(result.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload"
    );
    expect(result.allowedFormats).toEqual(["jpg", "jpeg", "png", "webp", "avif"]);
    expect(result.maxFileSize).toBeGreaterThan(0);
    expect(typeof result.signature).toBe("string");
    expect(result.signature.length).toBeGreaterThan(0);
  });

  it("never returns the API secret", async () => {
    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    // The signature goes to the browser. The secret must not travel with it.
    expect(JSON.stringify(buildUploadSignature("REF1042"))).not.toContain(
      "test-secret"
    );
  });

  it("signs different folders differently", async () => {
    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    const a = buildUploadSignature("REF1042");
    const b = buildUploadSignature("REF9999");

    // Same timestamp second, different folder — the signature must still differ, or
    // it is not actually covering the folder parameter.
    if (a.timestamp === b.timestamp) {
      expect(a.signature).not.toBe(b.signature);
    }
  });

  it("throws when Cloudinary is not configured", async () => {
    delete process.env.CLOUDINARY_API_SECRET;

    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    expect(() => buildUploadSignature("REF1042")).toThrow();
  });
});

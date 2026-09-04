import { describe, it, expect } from "vitest";

import { DEMO_IMAGES } from "../scripts/demoImages.js";
import { categoriesFor, galleryFor } from "../scripts/demoGallery.js";
import { PROPERTY_TYPES } from "../utils/constants.js";

/**
 * Demo gallery selection.
 *
 * These images are the entire visual impression the demo site makes, so the cases
 * that matter are the ones a reader would notice: the same photo twice in one
 * gallery, a bathroom photo on a land listing, or a re-seed that shuffles every
 * listing's pictures and makes the diff unreadable.
 */
describe("demo image catalogue", () => {
  it("has the four categories the selector routes to, each with enough photos", () => {
    expect(Object.keys(DEMO_IMAGES).sort()).toEqual([
      "commercial",
      "exterior",
      "interior",
      "land",
    ]);

    // Three picks per listing, so fewer than three would force a repeat. Twelve is
    // the generator's floor and keeps a results page from looking duplicated.
    for (const [category, items] of Object.entries(DEMO_IMAGES)) {
      expect(items.length, category).toBeGreaterThanOrEqual(12);
    }
  });

  it("records honest dimensions and a pexels CDN url for every entry", () => {
    for (const item of Object.values(DEMO_IMAGES).flat()) {
      // The stored width/height reserve layout space in PropertyCard; they are only
      // true because the url pins them with Pexels' own sizing params.
      expect(item.url).toMatch(/^https:\/\/images\.pexels\.com\/photos\//);
      expect(item.url).toContain("w=1200");
      expect(item.url).toContain("h=800");
      expect(item.width).toBe(1200);
      expect(item.height).toBe(800);
      expect(item.thumbnailUrl).toContain("w=400");
      expect(item.photographer).toBeTruthy();
      expect(item.sourceUrl).toBeTruthy();
    }
  });
});

describe("categoriesFor", () => {
  it("gives land listings land photos only", () => {
    expect(categoriesFor("land")).toEqual(["land", "land", "land"]);
  });

  it("gives commercial listings commercial photos only", () => {
    expect(categoriesFor("commercial")).toEqual([
      "commercial",
      "commercial",
      "commercial",
    ]);
  });

  it("leads a residential listing with an exterior, then interiors", () => {
    // The cover is displayOrder 0, so the exterior has to come first — a card
    // fronted by a bathroom reads as a mistake.
    expect(categoriesFor("detached")).toEqual(["exterior", "interior", "interior"]);
  });

  it("returns three known categories for every property type in the enum", () => {
    for (const type of PROPERTY_TYPES) {
      const categories = categoriesFor(type);
      expect(categories, type).toHaveLength(3);
      for (const category of categories) {
        expect(DEMO_IMAGES[category], `${type} -> ${category}`).toBeDefined();
      }
    }
  });
});

describe("galleryFor", () => {
  const title = "4 Bedroom Detached Duplex, Lekki Phase 1";

  it("returns three distinct photos", () => {
    const gallery = galleryFor("REF1042", "detached", title);

    expect(gallery).toHaveLength(3);
    expect(new Set(gallery.map((item) => item.url)).size).toBe(3);
  });

  it("is deterministic, so re-seeding does not reshuffle every listing", () => {
    expect(galleryFor("REF1042", "detached", title)).toEqual(
      galleryFor("REF1042", "detached", title)
    );
  });

  it("varies between listings", () => {
    const a = galleryFor("REF1042", "detached", title);
    const b = galleryFor("REF2099", "detached", title);

    expect(a.map((item) => item.url)).not.toEqual(b.map((item) => item.url));
  });

  it("composes alt text from the listing and the photo", () => {
    const [first] = galleryFor("REF1042", "detached", title);

    // The title alone does not describe the picture; the catalogue alt alone does
    // not identify the listing. Screen readers and image search need both.
    expect(first.alt).toContain(title);
    expect(first.alt).toMatch(/ — /);
    expect(first.alt.length).toBeGreaterThan(title.length + 3);
  });

  it("draws land photos for a land listing", () => {
    const gallery = galleryFor("REF3001", "land", "Plot of Land at Ibeju-Lekki");
    const landUrls = new Set(DEMO_IMAGES.land.map((item) => item.url));

    for (const item of gallery) {
      expect(landUrls.has(item.url)).toBe(true);
    }
  });
});

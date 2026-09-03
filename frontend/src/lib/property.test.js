import { describe, it, expect } from "vitest";
import { isRental, priceOf, coverImageOf, statusLabel, propertyPath } from "./property";

// A sale listing: figure lives on price.amount.
const saleListing = {
  slug: "grand-5-bedroom-mansion-ref1009",
  title: "Grand 5 Bedroom Mansion",
  listingType: "sale",
  status: "available",
  price: { currency: "NGN", amount: 127000000, isNegotiable: false, onRequest: false },
  rent: {},
  coverImage: { url: "https://placehold.co/1200x800", alt: "Front elevation" },
};

// A rent listing: price is present but has NO amount — the classic trap.
const rentListing = {
  slug: "3-bed-flat-akobo-ref1010",
  title: "3 Bedroom Flat",
  listingType: "rent",
  status: "available",
  price: { currency: "NGN", isNegotiable: false, onRequest: false },
  rent: { amount: 400000, period: "per_annum", advanceYears: 1 },
  coverImage: { url: "https://placehold.co/1200x800", alt: "Living room" },
};

describe("isRental", () => {
  it("reads listingType, not the presence of a rent object", () => {
    expect(isRental(rentListing)).toBe(true);
    expect(isRental(saleListing)).toBe(false);
  });
});

describe("priceOf", () => {
  it("reads price.amount for a sale", () => {
    expect(priceOf(saleListing)).toMatchObject({ label: "₦127m", suffix: null });
  });

  it("reads rent.amount for a rental and states the period explicitly", () => {
    expect(priceOf(rentListing)).toMatchObject({ label: "₦400k", suffix: "per year" });
  });

  it("does NOT treat a truthy price object with no amount as a price", () => {
    // The single most dangerous shape in the API: price is always truthy.
    const result = priceOf({ ...saleListing, price: { currency: "NGN" }, rent: {} });
    expect(result.label).toBe("Price on request");
    expect(result.label).not.toContain("0");
  });

  it("renders 'Price on request' as a real state, never ₦0", () => {
    const onRequest = { ...saleListing, price: { currency: "NGN", onRequest: true } };
    expect(priceOf(onRequest)).toMatchObject({ label: "Price on request", isOnRequest: true });
  });

  it("flags a negotiable price so the UI can badge it", () => {
    const negotiable = {
      ...saleListing,
      price: { ...saleListing.price, isNegotiable: true },
    };
    expect(priceOf(negotiable).isNegotiable).toBe(true);
  });

  it("respects USD pricing", () => {
    const usd = { ...saleListing, price: { currency: "USD", amount: 2500000 } };
    expect(priceOf(usd).label).toBe("$2.5m");
  });
});

describe("coverImageOf", () => {
  it("uses the cover image when present", () => {
    expect(coverImageOf(saleListing)).toMatchObject({
      url: "https://placehold.co/1200x800",
      isPlaceholder: false,
    });
  });

  it("falls back to a local placeholder rather than a broken frame", () => {
    const result = coverImageOf({ ...saleListing, coverImage: null });
    expect(result.isPlaceholder).toBe(true);
    expect(result.url).toBe("/placeholder-property.svg");
  });

  it("derives alt text from the title when the media record has none", () => {
    const result = coverImageOf({
      ...saleListing,
      coverImage: { url: "https://placehold.co/1200x800" },
    });
    expect(result.alt).toBe("Grand 5 Bedroom Mansion");
  });
});

describe("statusLabel", () => {
  it("always returns a text label, so status is never colour-only", () => {
    expect(statusLabel("available")).toEqual({ label: "Available", tone: "success" });
    expect(statusLabel("under_offer")).toEqual({ label: "Under offer", tone: "warning" });
    expect(statusLabel("sold")).toEqual({ label: "Sold", tone: "danger" });
    expect(statusLabel("rented")).toEqual({ label: "Rented", tone: "danger" });
    expect(statusLabel("off_market")).toEqual({ label: "Off market", tone: "muted" });
  });
});

describe("propertyPath", () => {
  it("builds the SEO listing URL from the API slug", () => {
    expect(propertyPath(saleListing)).toBe("/property/grand-5-bedroom-mansion-ref1009");
  });
});

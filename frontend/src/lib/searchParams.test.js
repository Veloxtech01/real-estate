import { describe, it, expect } from "vitest";
import { parseSearchParams, toQueryString, withFilter } from "./searchParams";

describe("parseSearchParams", () => {
  it("passes through the supported scalar filters", () => {
    expect(parseSearchParams({ listingType: "rent", location: "lekki" })).toEqual({
      listingType: "rent",
      location: "lekki",
    });
  });

  it("coerces numeric filters to numbers so the API isn't sent strings", () => {
    expect(parseSearchParams({ bedroomsMin: "3", priceMax: "200000000" })).toEqual({
      bedroomsMin: 3,
      priceMax: 200000000,
    });
  });

  it("drops a numeric filter that isn't a number rather than passing NaN on", () => {
    expect(parseSearchParams({ bedroomsMin: "many" })).toEqual({});
  });

  it("normalises amenities to an array whether one or many were selected", () => {
    expect(parseSearchParams({ amenities: "swimming_pool" }).amenities).toEqual(["swimming_pool"]);
    expect(parseSearchParams({ amenities: ["swimming_pool", "gym"] }).amenities).toEqual([
      "swimming_pool",
      "gym",
    ]);
  });

  it("rejects unknown keys — the URL must not become an open pipe to the API", () => {
    expect(parseSearchParams({ listingType: "sale", isFeatured: "true", evil: "1" })).toEqual({
      listingType: "sale",
      isFeatured: "true",
    });
  });

  it("keeps the free-text query", () => {
    expect(parseSearchParams({ q: "3 bedroom flat in Lekki" }).q).toBe("3 bedroom flat in Lekki");
  });

  it("defaults nothing — an empty URL means an unfiltered search", () => {
    expect(parseSearchParams({})).toEqual({});
  });
});

describe("toQueryString", () => {
  it("round-trips a parsed filter object", () => {
    const filters = { listingType: "rent", bedroomsMin: 3, amenities: ["gym", "pool"] };
    const params = new URLSearchParams(toQueryString(filters));
    const raw = {};
    for (const key of params.keys()) {
      const all = params.getAll(key);
      raw[key] = all.length > 1 ? all : all[0];
    }
    expect(parseSearchParams(raw)).toEqual(filters);
  });

  it("omits empty values instead of emitting bare keys", () => {
    expect(toQueryString({ listingType: "", bedroomsMin: 3 })).toBe("bedroomsMin=3");
  });

  it("repeats the key for array values", () => {
    expect(toQueryString({ amenities: ["gym", "pool"] })).toBe("amenities=gym&amenities=pool");
  });
});

describe("withFilter", () => {
  it("sets a value without mutating the original", () => {
    const before = { listingType: "rent" };
    const after = withFilter(before, "bedroomsMin", 3);
    expect(after).toEqual({ listingType: "rent", bedroomsMin: 3 });
    expect(before).toEqual({ listingType: "rent" });
  });

  it("removes the key when the value is cleared", () => {
    expect(withFilter({ listingType: "rent", bedroomsMin: 3 }, "bedroomsMin", null)).toEqual({
      listingType: "rent",
    });
  });

  it("resets pagination, because page 4 of the old filter is meaningless", () => {
    expect(withFilter({ page: 4 }, "listingType", "sale")).toEqual({ listingType: "sale" });
  });
});

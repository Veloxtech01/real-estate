import { describe, it, expect } from "vitest";
import { formatMoney, formatArea, formatRentPeriod, humanise, formatCount } from "./format";

describe("formatMoney", () => {
  it("abbreviates millions the way Nigerian buyers read prices", () => {
    expect(formatMoney(150000000, "NGN")).toBe("₦150m");
  });

  it("keeps one decimal place when it carries information", () => {
    expect(formatMoney(127500000, "NGN")).toBe("₦127.5m");
  });

  it("drops a trailing .0", () => {
    expect(formatMoney(127000000, "NGN")).toBe("₦127m");
  });

  it("abbreviates billions", () => {
    expect(formatMoney(1200000000, "NGN")).toBe("₦1.2b");
  });

  it("abbreviates thousands", () => {
    expect(formatMoney(400000, "NGN")).toBe("₦400k");
  });

  it("prints small amounts in full", () => {
    expect(formatMoney(950, "NGN")).toBe("₦950");
  });

  it("never assumes naira — USD stock exists", () => {
    expect(formatMoney(2500000, "USD")).toBe("$2.5m");
  });

  it("falls back to the code for an unknown currency", () => {
    expect(formatMoney(5000000, "GBP")).toBe("GBP 5m");
  });
});

describe("formatArea", () => {
  it("renders square metres, the only unit the API stores", () => {
    expect(formatArea(500)).toBe("500 m²");
  });

  it("returns null when there is no land size, so callers can omit the row", () => {
    expect(formatArea(null)).toBeNull();
    expect(formatArea(undefined)).toBeNull();
  });
});

describe("formatRentPeriod", () => {
  it("expands per_annum — the Nigerian default that a naive render gets wrong by 12x", () => {
    expect(formatRentPeriod("per_annum")).toBe("per year");
  });

  it("handles quarter and month", () => {
    expect(formatRentPeriod("per_quarter")).toBe("per quarter");
    expect(formatRentPeriod("per_month")).toBe("per month");
  });

  it("degrades gracefully on an unknown period rather than throwing", () => {
    expect(formatRentPeriod("per_fortnight")).toBe("per fortnight");
  });
});

describe("humanise", () => {
  it("turns a machine key into a label, since the API deliberately sends no labels", () => {
    expect(humanise("self_contained")).toBe("Self-contained");
    expect(humanise("boys_quarters")).toBe("Boys quarters");
  });

  it("uses the curated label where a naive transform would be wrong", () => {
    expect(humanise("c_of_o")).toBe("C of O");
    expect(humanise("governors_consent")).toBe("Governor's Consent");
  });

  it("returns an empty string for a missing key", () => {
    expect(humanise(undefined)).toBe("");
  });
});

describe("formatCount", () => {
  it("pluralises", () => {
    expect(formatCount(1, "bedroom")).toBe("1 bedroom");
    expect(formatCount(3, "bedroom")).toBe("3 bedrooms");
  });
});

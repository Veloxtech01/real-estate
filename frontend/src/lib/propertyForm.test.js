import { describe, it, expect } from "vitest";
import {
  toFormValues,
  toApiPayload,
  toSquareMetres,
  rentRulesFor,
  BLANK_LISTING,
} from "./propertyForm";

/**
 * The form/API translation.
 *
 * These conversions are the part of the editor that fails silently when wrong — a bad
 * land factor stores the wrong area with no visible symptom, and a stray `state` in the
 * payload would be a way past the statutory rent cap.
 */

const landUnits = { sqm: 1, plot: 648, plot_lagos: 464, acre: 4046.86 };

/** A filled-in sale form, as react-hook-form would hand it over. */
const saleValues = () => ({
  ...structuredClone(BLANK_LISTING),
  title: "4 Bedroom Duplex",
  propertyType: "duplex",
  location: "loc1",
  landmark: "Opposite Circle Mall",
  price: { amount: "95000000", currency: "NGN", isNegotiable: true, onRequest: false },
});

describe("toSquareMetres", () => {
  it("converts plots using the served factor, not a hardcoded one", () => {
    expect(toSquareMetres(2, "plot", landUnits)).toBe(1296);
    // The whole reason factors come from the API: a Lagos plot is materially smaller,
    // so the same input must not produce the same area.
    expect(toSquareMetres(2, "plot_lagos", landUnits)).toBe(928);
  });

  it("returns undefined for a blank value rather than zero", () => {
    // Number("") is 0, which would publish a listing sitting on no land at all.
    expect(toSquareMetres("", "sqm", landUnits)).toBeUndefined();
  });

  it("throws on an unknown unit instead of assuming square metres", () => {
    expect(() => toSquareMetres(1, "hectare", landUnits)).toThrow(/Unknown land unit/);
  });
});

describe("toApiPayload", () => {
  it("never sends state, even though the form displays one", () => {
    const payload = toApiPayload(saleValues(), { landUnits });
    // The server derives state from the location; accepting it from a client would let
    // a Lagos listing be filed elsewhere and skip the 10% agency-fee cap.
    expect(payload).not.toHaveProperty("state");
  });

  it("omits rent entirely on a sale", () => {
    const payload = toApiPayload(saleValues(), { landUnits });
    // The model rejects rent terms on a sale outright.
    expect(payload.rent).toBeUndefined();
    expect(payload.price.amount).toBe(95000000);
  });

  it("omits price and sends rent terms on a rental", () => {
    const values = {
      ...saleValues(),
      listingType: "rent",
      rent: {
        ...BLANK_LISTING.rent,
        amount: "4500000",
        agencyFeePct: "10",
        advanceYears: "1",
      },
    };

    const payload = toApiPayload(values, { landUnits });
    expect(payload.price).toBeUndefined();
    expect(payload.rent.amount).toBe(4500000);
    expect(payload.rent.agencyFeePct).toBe(10);
  });

  it("leaves the amount unset when the price is on request", () => {
    const values = saleValues();
    values.price.onRequest = true;

    const payload = toApiPayload(values, { landUnits });
    // On request is a genuine state, not a zero price.
    expect(payload.price.amount).toBeUndefined();
    expect(payload.price.onRequest).toBe(true);
  });

  it("sends coordinates only when both halves are present, longitude first", () => {
    const half = toApiPayload({ ...saleValues(), _lat: "6.44" }, { landUnits });
    expect(half.coordinates).toBeUndefined();

    const both = toApiPayload(
      { ...saleValues(), _lat: "6.44", _lng: "3.47" },
      { landUnits },
    );
    // GeoJSON order is [longitude, latitude] — the form shows the other way round.
    expect(both.coordinates).toEqual({ type: "Point", coordinates: [3.47, 6.44] });
  });

  it("only sends the agent assignment for an administrator", () => {
    const values = { ...saleValues(), agent: "agent1" };

    expect(toApiPayload(values, { landUnits }).agent).toBeUndefined();
    expect(toApiPayload(values, { landUnits, isAdministrator: true }).agent).toBe("agent1");
  });

  it("omits landTitle when no title type was chosen", () => {
    const payload = toApiPayload(saleValues(), { landUnits });
    // An empty enum string would fail schema validation on a listing that simply
    // hasn't recorded its title yet.
    expect(payload.landTitle).toBeUndefined();
  });

  it("converts the land size before sending it", () => {
    const values = { ...saleValues(), _landSizeValue: "1", _landSizeUnit: "plot" };
    expect(toApiPayload(values, { landUnits }).landSizeSqm).toBe(648);
  });
});

describe("toFormValues", () => {
  it("returns blank defaults for a new listing", () => {
    expect(toFormValues(null).listingType).toBe("sale");
    expect(toFormValues(null).tags).toEqual([]);
  });

  it("reads ids off populated references", () => {
    const values = toFormValues({
      title: "X",
      location: { _id: "loc1", name: "Lekki Phase 1" },
      agent: { _id: "a1", name: "Ada" },
      tags: [{ _id: "t1" }, { _id: "t2" }],
      coverImage: { _id: "m1" },
    });

    // The detail endpoint populates these; a freshly saved record returns bare ids.
    // Both have to load into the same controls.
    expect(values.location).toBe("loc1");
    expect(values.agent).toBe("a1");
    expect(values.tags).toEqual(["t1", "t2"]);
    expect(values.coverImage).toBe("m1");
  });

  it("shows coordinates latitude-first", () => {
    const values = toFormValues({
      title: "X",
      coordinates: { type: "Point", coordinates: [3.47, 6.44] },
    });

    expect(values._lat).toBe(6.44);
    expect(values._lng).toBe(3.47);
  });

  it("always loads land size back in square metres", () => {
    const values = toFormValues({ title: "X", landSizeSqm: 648 });
    // Re-deriving the original unit is guesswork, and calling 648 sqm "1 plot" would
    // be wrong for a Lagos listing.
    expect(values._landSizeValue).toBe(648);
    expect(values._landSizeUnit).toBe("sqm");
  });

  it("round-trips a rental without inventing a price", () => {
    const values = toFormValues({
      title: "X",
      listingType: "rent",
      location: "loc1",
      landmark: "Near the mall",
      rent: { amount: 4500000, period: "per_annum", advanceYears: 1 },
    });

    const payload = toApiPayload(values, { landUnits });
    expect(payload.rent.amount).toBe(4500000);
    expect(payload.price).toBeUndefined();
  });
});

describe("rentRulesFor", () => {
  const table = {
    Lagos: { maxAgencyFeePct: 10, maxAdvanceYears: 1 },
    default: { maxAgencyFeePct: 100, maxAdvanceYears: 10 },
  };

  it("returns the state's rules", () => {
    expect(rentRulesFor("Lagos", table).maxAgencyFeePct).toBe(10);
  });

  it("falls back to the table's default for an unlisted state", () => {
    // Deliberately permissive: absent a known statutory cap, we don't invent one.
    expect(rentRulesFor("Ogun", table).maxAgencyFeePct).toBe(100);
  });

  it("survives a reference payload that hasn't loaded", () => {
    expect(rentRulesFor("Lagos", undefined).maxAgencyFeePct).toBe(100);
  });
});

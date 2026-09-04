import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeroSearchPanel from "./HeroSearchPanel";

// The panel's whole job is to build a URL and push it, so the router is the assertion
// target — nothing here fetches.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args) => push(...args) }),
}));

const options = {
  locations: [
    { _id: "l1", name: "Lekki Phase 1", slug: "lekki-phase-1-lagos", state: "Lagos" },
    { _id: "l2", name: "Ikoyi", slug: "ikoyi-lagos", state: "Lagos" },
  ],
  propertyTypes: ["duplex", "self_contained"],
};

beforeEach(() => {
  push.mockClear();
});

describe("HeroSearchPanel", () => {
  it("browses everything when nothing is chosen", async () => {
    render(<HeroSearchPanel options={options} />);
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    // An untouched panel must not emit blank params — /properties?listingType= would
    // read as a filter the visitor never set.
    expect(push).toHaveBeenCalledWith("/properties");
  });

  it("builds a query string from only the controls that were set", async () => {
    render(<HeroSearchPanel options={options} />);

    await userEvent.selectOptions(screen.getByLabelText(/i want to/i), "rent");
    await userEvent.selectOptions(screen.getByLabelText(/location/i), "ikoyi-lagos");
    await userEvent.selectOptions(screen.getByLabelText(/bedrooms/i), "3");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    // Property type was left as "any" and must be absent, not sent empty.
    expect(push).toHaveBeenCalledWith(
      "/properties?listingType=rent&location=ikoyi-lagos&bedroomsMin=3",
    );
  });

  it("renders property types humanised but submits the machine key", async () => {
    render(<HeroSearchPanel options={options} />);

    // The API sends enum keys; the labels are a presentation concern owned by the UI.
    expect(screen.getByRole("option", { name: "Self-contained" })).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText(/property type/i),
      "self_contained",
    );
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(push).toHaveBeenCalledWith("/properties?propertyType=self_contained");
  });

  it("survives a missing filters payload", () => {
    // getFilters() can fail; the hero must still render a usable panel rather than
    // throwing and taking the whole homepage down with it.
    render(<HeroSearchPanel options={undefined} />);
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
  });
});

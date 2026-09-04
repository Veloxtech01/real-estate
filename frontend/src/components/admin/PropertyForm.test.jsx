import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PropertyForm from "./PropertyForm";

const createProperty = vi.fn();
const updateProperty = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  createProperty: (...args) => createProperty(...args),
  updateProperty: (...args) => updateProperty(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Re-assigned per test so role and publishing rights can vary.
let sessionUser = { name: "Ada", role: "administrator", canPublish: true };
vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: sessionUser }),
}));

/** A reference payload shaped like GET /api/admin/reference. */
const reference = {
  listingTypes: ["sale", "rent"],
  listingStatuses: ["available", "sold"],
  publicationStates: ["draft", "published"],
  propertyTypes: ["duplex", "apartment"],
  titleTypes: ["c_of_o", "excision", "gazette"],
  rentPeriods: ["per_annum", "per_month"],
  chargePeriods: ["per_annum", "one_off"],
  currencies: ["NGN", "USD"],
  powerSources: ["grid", "generator"],
  waterSources: ["borehole"],
  meteringTypes: ["prepaid"],
  floodRiskLevels: ["none", "high"],
  roadConditions: ["tarred"],
  landUnits: { sqm: 1, plot: 648 },
  stateRentRules: {
    Lagos: { maxAgencyFeePct: 10, maxAdvanceYears: 1 },
    default: { maxAgencyFeePct: 100, maxAdvanceYears: 10 },
  },
  locations: [{ _id: "loc1", name: "Lekki Phase 1", state: "Lagos" }],
  taxonomy: [{ _id: "t1", name: "Swimming pool", category: "amenity" }],
  agents: [{ _id: "a1", name: "Bola", canPublish: true }],
};

const listing = {
  _id: "p1",
  reference: "REF1042",
  title: "4 Bedroom Duplex",
  listingType: "sale",
  propertyType: "duplex",
  status: "available",
  publicationState: "draft",
  location: { _id: "loc1", name: "Lekki Phase 1", state: "Lagos" },
  landmark: "Opposite Circle Mall",
  price: { amount: 95000000, currency: "NGN" },
};

describe("PropertyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { name: "Ada", role: "administrator", canPublish: true };
  });

  it("shows sale pricing for a sale and swaps to rent terms when the type changes", async () => {
    const user = userEvent.setup();
    render(<PropertyForm property={listing} reference={reference} />);

    expect(screen.getByLabelText("Price")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Agency fee/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Listing type/), "rent");

    // The two never coexist: the model rejects rent terms on a sale outright.
    await waitFor(() => {
      expect(screen.getByLabelText(/Agency fee/)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Price")).not.toBeInTheDocument();
  });

  it("asks for a gazette number only once an excision title is chosen", async () => {
    const user = userEvent.setup();
    render(<PropertyForm property={listing} reference={reference} />);

    expect(screen.queryByLabelText(/Gazette number/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Title type/), "excision");

    // That number is precisely what a buyer's lawyer searches against.
    await waitFor(() => {
      expect(screen.getByLabelText(/Gazette number/)).toBeInTheDocument();
    });
  });

  it("shows the state derived from the chosen area, with no way to edit it", () => {
    render(<PropertyForm property={listing} reference={reference} />);

    expect(screen.getByText(/Derived from the area/)).toBeInTheDocument();
    // No input for it — the server derives it, and accepting one would be a route
    // around the Lagos rent cap.
    expect(screen.queryByLabelText(/^State/)).not.toBeInTheDocument();
  });

  it("warns about the Lagos agency-fee cap before submitting", async () => {
    const user = userEvent.setup();
    render(
      <PropertyForm
        property={{ ...listing, listingType: "rent", rent: { amount: 4500000 } }}
        reference={reference}
      />,
    );

    await user.type(screen.getByLabelText(/Agency fee/), "11");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(await screen.findByText(/cannot exceed 10%/)).toBeInTheDocument();
    // Advisory, but it still saves a pointless round trip.
    expect(updateProperty).not.toHaveBeenCalled();
  });

  it("maps a server validation error back onto its field", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { "rent.agencyFeePct": "Agency fee cannot exceed 10% in Lagos" };
    updateProperty.mockRejectedValue(failure);

    render(
      <PropertyForm
        property={{ ...listing, listingType: "rent", rent: { amount: 4500000 } }}
        reference={reference}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    // The API is the authority; its wording lands on the input that caused it.
    expect(
      await screen.findByText("Agency fee cannot exceed 10% in Lagos"),
    ).toBeInTheDocument();
  });

  it("shows a server message with no matching field in the banner", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { landSizeSqm: "Land size is implausible" };
    updateProperty.mockRejectedValue(failure);

    render(<PropertyForm property={listing} reference={reference} />);
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    // The form registers _landSizeValue, not landSizeSqm — so this has to surface
    // somewhere rather than being swallowed.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Land size is implausible",
    );
  });

  it("sends the nested payload the API expects on create", async () => {
    const user = userEvent.setup();
    createProperty.mockResolvedValue({ _id: "new1", reference: "REF1043" });

    render(<PropertyForm reference={reference} />);

    await user.type(screen.getByLabelText(/Listing title/), "2 Bedroom Flat");
    await user.selectOptions(screen.getByLabelText(/Property type/), "apartment");
    await user.selectOptions(screen.getByLabelText(/^Area/), "loc1");
    await user.type(screen.getByLabelText(/Landmark/), "Near the mall");
    await user.type(screen.getByLabelText("Price"), "45000000");

    await user.click(screen.getByRole("button", { name: /Create listing/ }));

    await waitFor(() => expect(createProperty).toHaveBeenCalled());
    const payload = createProperty.mock.calls[0][0];
    expect(payload.title).toBe("2 Bedroom Flat");
    expect(payload.price.amount).toBe(45000000);
    expect(payload).not.toHaveProperty("state");
  });

  it("offers the agent assignment to an administrator only", () => {
    const { unmount } = render(<PropertyForm property={listing} reference={reference} />);
    expect(screen.getByLabelText(/Assigned agent/)).toBeInTheDocument();
    unmount();

    sessionUser = { name: "Junior", role: "agent", canPublish: true };
    render(<PropertyForm property={listing} reference={reference} />);
    // The API forces an agent's own id regardless, so the control would do nothing.
    expect(screen.queryByLabelText(/Assigned agent/)).not.toBeInTheDocument();
  });

  it("disables publishing for an agent without the right, and says why", () => {
    sessionUser = { name: "Junior", role: "agent", canPublish: false };
    render(<PropertyForm property={listing} reference={reference} />);

    const published = screen.getByRole("option", { name: "Published" });
    // Courtesy, not security — the API 403s regardless. It just stops someone filling
    // in the whole form before being refused.
    expect(published).toBeDisabled();
    expect(screen.getByText(/An administrator publishes your listings/)).toBeInTheDocument();
  });

  it("lets an agent with publishing rights choose Published", () => {
    sessionUser = { name: "Senior", role: "agent", canPublish: true };
    render(<PropertyForm property={listing} reference={reference} />);

    expect(screen.getByRole("option", { name: "Published" })).not.toBeDisabled();
  });
});

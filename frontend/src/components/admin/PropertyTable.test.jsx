import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PropertyTable from "./PropertyTable";

const deleteProperty = vi.fn();
const restoreProperty = vi.fn();
const featureProperty = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  deleteProperty: (...args) => deleteProperty(...args),
  restoreProperty: (...args) => restoreProperty(...args),
  featureProperty: (...args) => featureProperty(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let sessionUser = { name: "Ada", role: "administrator" };
vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: sessionUser }),
}));

const sale = {
  _id: "p1",
  reference: "REF1042",
  title: "4 Bedroom Duplex",
  listingType: "sale",
  propertyType: "duplex",
  status: "available",
  publicationState: "published",
  isFeatured: false,
  deletedAt: null,
  location: { name: "Lekki Phase 1" },
  price: { amount: 95000000, currency: "NGN" },
};

const rental = {
  ...sale,
  _id: "p2",
  reference: "REF1043",
  title: "2 Bedroom Flat",
  listingType: "rent",
  // The trap: price is truthy even on a rental, and here it even carries a figure.
  price: { amount: 95000000, currency: "NGN" },
  rent: { amount: 4500000, period: "per_annum" },
};

describe("PropertyTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { name: "Ada", role: "administrator" };
  });

  it("shows the rent figure on a rental, not the price object", () => {
    render(<PropertyTable properties={[rental]} onChanged={vi.fn()} />);

    // `if (property.price)` is always true, so branching on it would print the sale
    // price on every let.
    expect(screen.getByText(/₦4\.5m/)).toBeInTheDocument();
    expect(screen.queryByText(/₦95m/)).not.toBeInTheDocument();
  });

  it("says 'On request' rather than showing a zero", () => {
    render(
      <PropertyTable
        properties={[{ ...sale, price: { onRequest: true, currency: "NGN" } }]}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("On request")).toBeInTheDocument();
  });

  it("hides the feature toggle from an agent", () => {
    sessionUser = { name: "Junior", role: "agent" };
    render(<PropertyTable properties={[sale]} onChanged={vi.fn()} />);

    // Courtesy only — the API returns 403 whatever renders.
    expect(screen.queryByRole("button", { name: /Feature/ })).not.toBeInTheDocument();
    // Delete stays: an agent manages their own listings.
    expect(screen.getByRole("button", { name: /Delete/ })).toBeInTheDocument();
  });

  it("toggles featuring and refetches", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    featureProperty.mockResolvedValue({});

    render(<PropertyTable properties={[sale]} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: /Feature/ }));

    expect(featureProperty).toHaveBeenCalledWith("p1", true);
    // No optimistic update — the row re-renders from the server's answer.
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("confirms before deleting, and says the delete is reversible", async () => {
    const user = userEvent.setup();
    deleteProperty.mockResolvedValue();

    render(<PropertyTable properties={[sale]} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Delete 4 Bedroom Duplex/ }));

    // Unlike a lead, where deletion is a permanent NDPA erasure.
    expect(screen.getByText(/you can restore it/i)).toBeInTheDocument();
    expect(deleteProperty).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete listing" }));
    await waitFor(() => expect(deleteProperty).toHaveBeenCalledWith("p1"));
  });

  it("offers Restore instead of Delete on a deleted row", () => {
    render(
      <PropertyTable
        properties={[{ ...sale, deletedAt: new Date().toISOString() }]}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Restore/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it("surfaces an API refusal verbatim rather than a generic message", async () => {
    const user = userEvent.setup();
    const toast = (await import("react-hot-toast")).default;
    featureProperty.mockRejectedValue(new Error("You can only manage your own listings"));

    render(<PropertyTable properties={[sale]} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Feature/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("You can only manage your own listings"),
    );
  });
});

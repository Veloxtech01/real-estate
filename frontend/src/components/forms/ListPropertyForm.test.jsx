import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListPropertyForm from "./ListPropertyForm";

// The Axios client is the boundary — stub it, not axios itself.
const submitEnquiry = vi.fn();
vi.mock("@/lib/api/client", () => ({
  submitEnquiry: (...args) => submitEnquiry(...args),
}));

// Toasts are a side effect, not something these assertions care about.
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const propertyTypes = ["duplex", "apartment", "land"];

beforeEach(() => {
  submitEnquiry.mockReset();
});

describe("ListPropertyForm", () => {
  it("requires listing type, location, name and phone", async () => {
    const user = userEvent.setup();
    render(<ListPropertyForm propertyTypes={propertyTypes} />);

    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/property location is required/i)).toBeInTheDocument();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it("populates the property type select from the propertyTypes prop", () => {
    render(<ListPropertyForm propertyTypes={propertyTypes} />);
    expect(screen.getByRole("option", { name: "Duplex" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Apartment" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Land" })).toBeInTheDocument();
  });

  it("submits only the filled-in fields inside requirement, with type/source fixed", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1", status: "new" });
    render(<ListPropertyForm propertyTypes={propertyTypes} />);

    await user.selectOptions(screen.getByLabelText(/listing intent/i), "sale");
    await user.type(screen.getByLabelText(/property location/i), "Lekki Phase 1, Lagos");
    await user.type(screen.getByLabelText(/your name/i), "Amaka Obi");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalledTimes(1));
    const payload = submitEnquiry.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Amaka Obi",
      phone: "+2348012345678",
      type: "list_property",
      source: "list_property_page",
      consentGiven: true,
      requirement: { listingType: "sale", location: "Lekki Phase 1, Lagos" },
    });
    // Optional fields left blank must not appear at all, not as "" or NaN.
    expect(payload.requirement).not.toHaveProperty("propertyType");
    expect(payload.requirement).not.toHaveProperty("bedrooms");
    expect(payload.requirement).not.toHaveProperty("expectedPrice");
  });

  it("includes optional fields as numbers when filled in", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1" });
    render(<ListPropertyForm propertyTypes={propertyTypes} />);

    await user.selectOptions(screen.getByLabelText(/listing intent/i), "rent");
    await user.selectOptions(screen.getByLabelText(/property type/i), "duplex");
    await user.type(screen.getByLabelText(/property location/i), "Ikoyi, Lagos");
    await user.selectOptions(screen.getByLabelText(/bedrooms/i), "4");
    await user.type(screen.getByLabelText(/expected annual rent/i), "12000000");
    await user.type(screen.getByLabelText(/your name/i), "Amaka Obi");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalledTimes(1));
    expect(submitEnquiry.mock.calls[0][0].requirement).toEqual({
      listingType: "rent",
      propertyType: "duplex",
      location: "Ikoyi, Lagos",
      bedrooms: 4,
      expectedPrice: 12000000,
    });
  });

  it("switches the price label between sale and rent wording", async () => {
    const user = userEvent.setup();
    render(<ListPropertyForm propertyTypes={propertyTypes} />);

    expect(screen.getByLabelText(/expected sale price/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/listing intent/i), "rent");
    expect(screen.getByLabelText(/expected annual rent/i)).toBeInTheDocument();
  });

  it("maps the API's field-level details onto the offending inputs", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { phone: "Enter a valid Nigerian phone number" };
    submitEnquiry.mockRejectedValue(failure);
    render(<ListPropertyForm propertyTypes={propertyTypes} />);

    await user.type(screen.getByLabelText(/property location/i), "Ikoyi");
    await user.type(screen.getByLabelText(/your name/i), "Amaka Obi");
    await user.type(screen.getByLabelText(/phone/i), "123");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/enter a valid nigerian phone number/i)).toBeInTheDocument();
  });

  it("keeps marketing opt-in separate from contact consent", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1" });
    render(<ListPropertyForm propertyTypes={propertyTypes} />);

    await user.type(screen.getByLabelText(/property location/i), "Ikoyi");
    await user.type(screen.getByLabelText(/your name/i), "Amaka Obi");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalled());
    expect(submitEnquiry.mock.calls[0][0].marketingOptIn).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EnquiryForm from "./EnquiryForm";

// The Axios client is the boundary — stub it, not axios itself.
const submitEnquiry = vi.fn();
vi.mock("@/lib/api/client", () => ({
  submitEnquiry: (...args) => submitEnquiry(...args),
}));

// Toasts are a side effect, not something these assertions care about.
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const property = {
  _id: "abc123",
  slug: "grand-5-bedroom-mansion-ref1009",
  title: "Grand 5 Bedroom Mansion",
  reference: "REF1009",
};

beforeEach(() => {
  submitEnquiry.mockReset();
});

describe("EnquiryForm", () => {
  it("requires a name and phone — email is optional in this market", async () => {
    const user = userEvent.setup();
    render(<EnquiryForm property={property} />);

    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it("submits the listing slug and the consent flag", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1", status: "new" });
    render(<EnquiryForm property={property} />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalledTimes(1));
    expect(submitEnquiry.mock.calls[0][0]).toMatchObject({
      name: "Chidi Nwosu",
      phone: "+2348012345678",
      property: "grand-5-bedroom-mansion-ref1009",
      type: "property_enquiry",
      source: "property_page",
      consentGiven: true,
    });
  });

  it("keeps marketing opt-in separate from contact consent", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1" });
    render(<EnquiryForm property={property} />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalled());
    // Agreeing to a callback is not agreeing to marketing alerts (NDPA, scope §11).
    expect(submitEnquiry.mock.calls[0][0].marketingOptIn).toBe(false);
  });

  it("maps the API's field-level details onto the offending inputs", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { phone: "Enter a valid Nigerian phone number" };
    submitEnquiry.mockRejectedValue(failure);
    render(<EnquiryForm property={property} />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "123");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    expect(await screen.findByText(/enter a valid nigerian phone number/i)).toBeInTheDocument();
  });
});

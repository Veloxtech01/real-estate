import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EnquiryDetail from "./EnquiryDetail";

const getEnquiry = vi.fn();
const updateEnquiry = vi.fn();
const deleteEnquiry = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  getEnquiry: (...args) => getEnquiry(...args),
  updateEnquiry: (...args) => updateEnquiry(...args),
  deleteEnquiry: (...args) => deleteEnquiry(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The session role decides which controls render.
let role = "agent";
vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: { name: "Ada", role } }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const enquiry = {
  _id: "e1",
  name: "Chidi Nwosu",
  phone: "+2348012345678",
  email: "chidi@example.com",
  message: "Is this still available?",
  status: "new",
  type: "property_enquiry",
  source: "property_page",
  notes: "",
  createdAt: "2026-09-01T10:00:00.000Z",
  property: { title: "3 Bed Flat, Lekki", slug: "3-bed-flat-lekki-ref1", reference: "REF1" },
  agent: { name: "Ada Agent" },
};

beforeEach(() => {
  role = "agent";
  getEnquiry.mockReset().mockResolvedValue({ enquiry });
  updateEnquiry.mockReset().mockResolvedValue({ enquiry });
  deleteEnquiry.mockReset().mockResolvedValue(undefined);
});

describe("EnquiryDetail", () => {
  it("renders the lead's contact details and message", async () => {
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    expect(await screen.findByText("Chidi Nwosu")).toBeInTheDocument();
    expect(screen.getByText("+2348012345678")).toBeInTheDocument();
    expect(screen.getByText(/Is this still available/)).toBeInTheDocument();
  });

  it("hides the delete control from an agent", async () => {
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    // The API returns 403 regardless — hiding it is courtesy, not security.
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("shows the delete control to an administrator", async () => {
    role = "administrator";
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("saves a status change and tells the parent to refresh", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<EnquiryDetail id="e1" onChanged={onChanged} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.selectOptions(screen.getByLabelText(/status/i), "contacted");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateEnquiry).toHaveBeenCalledTimes(1));
    expect(updateEnquiry).toHaveBeenCalledWith("e1", {
      status: "contacted",
      notes: "",
    });
    // The list shows status too, so it has to re-read after a change.
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("surfaces a field-level API error next to the field", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { status: "That status is not allowed here" };
    updateEnquiry.mockRejectedValue(failure);

    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/That status is not allowed here/)).toBeInTheDocument();
  });

  it("warns that deletion is permanent before deleting", async () => {
    const user = userEvent.setup();
    role = "administrator";
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /delete/i }));

    // NDPA erasure has no undo — the dialog body must say so. Matched on the specific
    // sentence rather than /permanent/i, which also hits the "Delete permanently" button.
    expect(await screen.findByText(/cannot be undone, and there is no restore/i))
      .toBeInTheDocument();
    // Opening the dialog must not itself delete anything.
    expect(deleteEnquiry).not.toHaveBeenCalled();
  });
});

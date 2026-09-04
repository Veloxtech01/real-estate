import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ViewingDetail from "./ViewingDetail";

const getViewing = vi.fn();
const updateViewing = vi.fn();
const deleteViewing = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  getViewing: (...args) => getViewing(...args),
  updateViewing: (...args) => updateViewing(...args),
  deleteViewing: (...args) => deleteViewing(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: { name: "Ada", role: "administrator" } }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** A date safely in the future, formatted for a datetime-local input. */
function futureLocal(days) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 16);
}

const base = {
  _id: "v1",
  name: "Chidi Nwosu",
  phone: "+2348012345678",
  email: "chidi@example.com",
  status: "requested",
  requestedFor: new Date(Date.now() + 3 * 86400000).toISOString(),
  scheduledFor: null,
  responseMessage: "",
  notes: "",
  property: { title: "3 Bed Flat, Lekki", slug: "3-bed-flat-lekki-ref1", reference: "REF1" },
};

beforeEach(() => {
  getViewing.mockReset().mockResolvedValue({ viewing: base });
  updateViewing.mockReset().mockResolvedValue({ viewing: base });
  deleteViewing.mockReset().mockResolvedValue(undefined);
});

describe("ViewingDetail", () => {
  it("offers every legal action for a requested viewing", async () => {
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /propose new time/i })).toBeInTheDocument();
  });

  it("offers no actions for a terminal status", async () => {
    getViewing.mockResolvedValue({ viewing: { ...base, status: "completed" } });
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    // Reopening a completed viewing would misrepresent what happened.
    expect(screen.getByText(/no further/i)).toBeInTheDocument();
  });

  it("accepts without a date, letting the API inherit requestedFor", async () => {
    const user = userEvent.setup();
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => expect(updateViewing).toHaveBeenCalledTimes(1));
    const [, body] = updateViewing.mock.calls[0];
    expect(body.status).toBe("accepted");
    // Omitted on purpose — the backend defaults it to requestedFor.
    expect(body.scheduledFor).toBeUndefined();
  });

  it("requires a future date to reschedule", async () => {
    const user = userEvent.setup();
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /propose new time/i }));

    // Submitting the reschedule form with no date must not reach the API.
    await user.click(screen.getByRole("button", { name: /^confirm new time$/i }));
    expect(updateViewing).not.toHaveBeenCalled();
    expect(await screen.findByText(/date is required/i)).toBeInTheDocument();
  });

  it("sends a reschedule with the chosen future time", async () => {
    const user = userEvent.setup();
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /propose new time/i }));

    await user.type(screen.getByLabelText(/new date and time/i), futureLocal(9));
    await user.click(screen.getByRole("button", { name: /^confirm new time$/i }));

    await waitFor(() => expect(updateViewing).toHaveBeenCalledTimes(1));
    expect(updateViewing.mock.calls[0][1].status).toBe("rescheduled");
    expect(updateViewing.mock.calls[0][1].scheduledFor).toBeTruthy();
  });

  it("surfaces the API's message when it rejects a transition", async () => {
    const user = userEvent.setup();
    const failure = new Error("A completed viewing cannot be moved to requested.");
    updateViewing.mockRejectedValue(failure);

    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /accept/i }));

    // The backend table is the authority; its wording is shown verbatim.
    await waitFor(() => expect(updateViewing).toHaveBeenCalled());
    expect(await screen.findByText(/cannot be moved to requested/i)).toBeInTheDocument();
  });
});

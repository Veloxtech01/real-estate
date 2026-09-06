import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTable from "./StaffTable";

const updateStaffMember = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  updateStaffMember: (...args) => updateStaffMember(...args),
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

let sessionUser = { _id: "admin1", name: "Ada", role: "administrator" };
vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: sessionUser }),
}));

const active = {
  _id: "s1",
  name: "Junior Agent",
  email: "junior@example.com",
  role: "agent",
  position: "Sales Consultant",
  isActive: true,
};

const inactive = {
  _id: "s2",
  name: "Former Agent",
  email: "former@example.com",
  role: "agent",
  position: "",
  isActive: false,
};

describe("StaffTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { _id: "admin1", name: "Ada", role: "administrator" };
  });

  it("renders an active and an inactive account with a visible status badge", () => {
    render(<StaffTable staff={[active, inactive]} onChanged={vi.fn()} />);

    expect(screen.getByText("Junior Agent")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Former Agent")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("confirms before deactivating, and says the action is reversible", async () => {
    const user = userEvent.setup();
    updateStaffMember.mockResolvedValue({});

    render(<StaffTable staff={[active]} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Deactivate Junior Agent/ }));

    expect(screen.getByText(/reactivate them from this table/i)).toBeInTheDocument();
    expect(updateStaffMember).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(updateStaffMember).toHaveBeenCalledWith("s1", { isActive: false }),
    );
  });

  it("reactivates immediately, without a confirmation dialog", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    updateStaffMember.mockResolvedValue({});

    render(<StaffTable staff={[inactive]} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: /Reactivate Former Agent/ }));

    expect(updateStaffMember).toHaveBeenCalledWith("s2", { isActive: true });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("hides the deactivate control on the signed-in administrator's own row", () => {
    render(<StaffTable staff={[{ ...active, _id: "admin1", name: "Ada" }]} onChanged={vi.fn()} />);

    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Deactivate/ })).not.toBeInTheDocument();
  });

  it("surfaces an API refusal verbatim rather than a generic message", async () => {
    const user = userEvent.setup();
    const toast = (await import("react-hot-toast")).default;
    updateStaffMember.mockRejectedValue(new Error("You cannot deactivate your own account"));

    render(<StaffTable staff={[active]} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Deactivate Junior Agent/ }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("You cannot deactivate your own account"),
    );
  });
});

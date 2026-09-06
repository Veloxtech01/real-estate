import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffForm from "./StaffForm";

const createStaffMember = vi.fn();
const updateStaffMember = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  createStaffMember: (...args) => createStaffMember(...args),
  updateStaffMember: (...args) => updateStaffMember(...args),
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

const staffRoles = ["administrator", "agent"];

const staffMember = {
  _id: "s1",
  name: "Junior Agent",
  email: "junior@example.com",
  role: "agent",
  phone: "+2348012345678",
  whatsapp: "",
  position: "Sales Consultant",
  bio: "",
  registrationNumber: "",
  canPublish: false,
  isPublic: true,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StaffForm", () => {
  it("requires name, email and password on create", async () => {
    const user = userEvent.setup();
    render(<StaffForm staffRoles={staffRoles} />);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(createStaffMember).not.toHaveBeenCalled();
  });

  it("creates an account and redirects to it", async () => {
    const user = userEvent.setup();
    createStaffMember.mockResolvedValue({ _id: "new1", name: "New Consultant" });
    render(<StaffForm staffRoles={staffRoles} />);

    await user.type(screen.getByLabelText(/full name/i), "New Consultant");
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/temporary password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(createStaffMember).toHaveBeenCalledTimes(1));
    expect(createStaffMember.mock.calls[0][0]).toMatchObject({
      name: "New Consultant",
      email: "new@example.com",
      password: "supersecret",
      role: "agent",
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/staff/new1"));
  });

  it("omits the password field on edit when left blank", async () => {
    const user = userEvent.setup();
    updateStaffMember.mockResolvedValue({});
    render(<StaffForm staffMember={staffMember} staffRoles={staffRoles} onSaved={vi.fn()} />);

    // Password is optional on edit — no text typed into it.
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(updateStaffMember).toHaveBeenCalledTimes(1));
    expect(updateStaffMember.mock.calls[0][0]).toBe("s1");
    expect(updateStaffMember.mock.calls[0][1]).not.toHaveProperty("password");
  });

  it("sends a new password on edit when one is typed", async () => {
    const user = userEvent.setup();
    updateStaffMember.mockResolvedValue({});
    render(<StaffForm staffMember={staffMember} staffRoles={staffRoles} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/new password/i), "brand-new-password");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(updateStaffMember).toHaveBeenCalledTimes(1));
    expect(updateStaffMember.mock.calls[0][1].password).toBe("brand-new-password");
  });

  it("maps the API's field-level details onto the offending inputs", async () => {
    const user = userEvent.setup();
    const failure = new Error("Invalid staff details");
    failure.details = { email: "Email is already in use" };
    createStaffMember.mockRejectedValue(failure);
    render(<StaffForm staffRoles={staffRoles} />);

    await user.type(screen.getByLabelText(/full name/i), "New Consultant");
    await user.type(screen.getByLabelText(/email/i), "junior@example.com");
    await user.type(screen.getByLabelText(/temporary password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email is already in use/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdminSessionProvider, useAdminSession } from "./AdminSessionProvider";

const getMe = vi.fn();
const logout = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  getMe: (...args) => getMe(...args),
  logout: (...args) => logout(...args),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

/** Renders whatever the session context currently holds. */
function Probe() {
  const { user } = useAdminSession();
  return <p>Signed in as {user.name}</p>;
}

beforeEach(() => {
  getMe.mockReset();
  logout.mockReset();
  replace.mockReset();
});

describe("AdminSessionProvider", () => {
  it("renders children once the session resolves", async () => {
    getMe.mockResolvedValue({ user: { name: "Ada Agent", role: "agent" } });

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    expect(await screen.findByText(/Signed in as Ada Agent/)).toBeInTheDocument();
  });

  it("does not render children while the session is loading", () => {
    // Never resolves — the provider must not flash an unauthenticated shell.
    getMe.mockReturnValue(new Promise(() => {}));

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("redirects to login when the session call fails", async () => {
    const failure = new Error("Authentication required");
    failure.status = 401;
    getMe.mockRejectedValue(failure);

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});

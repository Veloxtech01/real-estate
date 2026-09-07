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

  it("clears the session (without redirecting itself) when the session call fails", async () => {
    // Redirect-on-401 is centralized in the Axios interceptor (lib/api/client.js),
    // which clears the stale cookie first. If the provider also redirected here, the
    // two would race and could send the browser to /admin/login before the cookie is
    // cleared — which proxy.js bounces straight back to /admin, looping.
    const failure = new Error("Authentication required");
    failure.status = 401;
    getMe.mockRejectedValue(failure);

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    await waitFor(() => expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
});

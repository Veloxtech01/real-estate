import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlogTable from "./BlogTable";

const deleteBlogPost = vi.fn();
const restoreBlogPost = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  deleteBlogPost: (...args) => deleteBlogPost(...args),
  restoreBlogPost: (...args) => restoreBlogPost(...args),
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

const published = {
  _id: "p1",
  title: "Lekki rents are up again",
  author: { name: "Adaeze Okonkwo" },
  publicationState: "published",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

const deleted = {
  _id: "p2",
  title: "Old draft",
  author: null,
  publicationState: "draft",
  updatedAt: "2026-02-01T00:00:00.000Z",
  deletedAt: "2026-02-15T00:00:00.000Z",
};

describe("BlogTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a published and a deleted post with a visible status badge", () => {
    render(<BlogTable posts={[published, deleted]} onChanged={vi.fn()} />);

    expect(screen.getByText("Lekki rents are up again")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Old draft")).toBeInTheDocument();
    expect(screen.getByText("Deleted")).toBeInTheDocument();
  });

  it("confirms before deleting, and says the action is reversible", async () => {
    const user = userEvent.setup();
    deleteBlogPost.mockResolvedValue({});

    render(<BlogTable posts={[published]} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Delete Lekki rents are up again/ }));

    expect(screen.getByText(/restore it from this table/i)).toBeInTheDocument();
    expect(deleteBlogPost).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete post" }));
    await waitFor(() => expect(deleteBlogPost).toHaveBeenCalledWith("p1"));
  });

  it("restores immediately, without a confirmation dialog", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    restoreBlogPost.mockResolvedValue({});

    render(<BlogTable posts={[deleted]} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: /Restore Old draft/ }));

    expect(restoreBlogPost).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("surfaces an API refusal verbatim rather than a generic message", async () => {
    const user = userEvent.setup();
    const toast = (await import("react-hot-toast")).default;
    deleteBlogPost.mockRejectedValue(new Error("Something went wrong"));

    render(<BlogTable posts={[published]} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Delete Lekki rents are up again/ }));
    await user.click(screen.getByRole("button", { name: "Delete post" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong"));
  });

  it("shows a message when there are no posts", () => {
    render(<BlogTable posts={[]} onChanged={vi.fn()} />);
    expect(screen.getByText(/no posts match these filters/i)).toBeInTheDocument();
  });
});

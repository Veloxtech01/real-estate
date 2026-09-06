import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlogForm from "./BlogForm";

const createBlogPost = vi.fn();
const updateBlogPost = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  createBlogPost: (...args) => createBlogPost(...args),
  updateBlogPost: (...args) => updateBlogPost(...args),
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

const publicationStates = ["draft", "published"];
const staffAuthors = [{ _id: "a1", name: "Adaeze Okonkwo" }];

const post = {
  _id: "p1",
  title: "Lekki rents are up again",
  excerpt: "A look at the numbers.",
  body: "Rents have risen.",
  coverImage: "",
  author: { _id: "a1" },
  categories: ["Market Trends", "Lekki"],
  tags: ["rent"],
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  publicationState: "draft",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BlogForm", () => {
  it("requires a title and a body on create", async () => {
    const user = userEvent.setup();
    render(<BlogForm staffAuthors={staffAuthors} publicationStates={publicationStates} />);

    await user.click(screen.getByRole("button", { name: /create post/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/body is required/i)).toBeInTheDocument();
    expect(createBlogPost).not.toHaveBeenCalled();
  });

  it("creates a post and redirects to it", async () => {
    const user = userEvent.setup();
    createBlogPost.mockResolvedValue({ _id: "new1", title: "New post" });
    render(<BlogForm staffAuthors={staffAuthors} publicationStates={publicationStates} />);

    await user.type(screen.getByLabelText(/^title$/i), "New post");
    await user.type(screen.getByLabelText(/body/i), "Body text.");
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => expect(createBlogPost).toHaveBeenCalledTimes(1));
    expect(createBlogPost.mock.calls[0][0]).toMatchObject({
      title: "New post",
      body: "Body text.",
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/blog/new1"));
  });

  it("splits comma-separated categories and tags into arrays", async () => {
    const user = userEvent.setup();
    createBlogPost.mockResolvedValue({ _id: "new1", title: "New post" });
    render(<BlogForm staffAuthors={staffAuthors} publicationStates={publicationStates} />);

    await user.type(screen.getByLabelText(/^title$/i), "New post");
    await user.type(screen.getByLabelText(/body/i), "Body text.");
    await user.type(screen.getByLabelText(/categories/i), "Market Trends,  Lekki ,");
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => expect(createBlogPost).toHaveBeenCalledTimes(1));
    expect(createBlogPost.mock.calls[0][0].categories).toEqual(["Market Trends", "Lekki"]);
  });

  it("pre-fills comma-joined categories and tags when editing", () => {
    render(
      <BlogForm post={post} staffAuthors={staffAuthors} publicationStates={publicationStates} />,
    );

    expect(screen.getByLabelText(/categories/i)).toHaveValue("Market Trends, Lekki");
    expect(screen.getByLabelText(/tags/i)).toHaveValue("rent");
  });

  it("sends null for author when left unset", async () => {
    const user = userEvent.setup();
    updateBlogPost.mockResolvedValue({});
    render(
      <BlogForm
        post={{ ...post, author: null }}
        staffAuthors={staffAuthors}
        publicationStates={publicationStates}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(updateBlogPost).toHaveBeenCalledTimes(1));
    expect(updateBlogPost.mock.calls[0][1].author).toBeNull();
  });

  it("maps the API's field-level details onto the offending inputs", async () => {
    const user = userEvent.setup();
    const failure = new Error("Invalid post details");
    failure.details = { title: "Title is required" };
    createBlogPost.mockRejectedValue(failure);
    render(<BlogForm staffAuthors={staffAuthors} publicationStates={publicationStates} />);

    await user.type(screen.getByLabelText(/^title$/i), "x");
    await user.type(screen.getByLabelText(/body/i), "Body text.");
    await user.click(screen.getByRole("button", { name: /create post/i }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });
});

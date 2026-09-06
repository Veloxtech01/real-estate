import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogCard from "./BlogCard";

// Vitest does not run the Next compiler — next/link needs stubbing, same as
// TeamCard.test.jsx.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const post = {
  slug: "lekki-rents-are-up-again",
  title: "Lekki rents are up again",
  excerpt: "A look at the numbers.",
  publishedAt: "2026-03-01T00:00:00.000Z",
  categories: ["Market Trends"],
};

describe("BlogCard", () => {
  it("renders the title, excerpt and publish date", () => {
    render(<BlogCard post={post} />);
    expect(screen.getByText("Lekki rents are up again")).toBeInTheDocument();
    expect(screen.getByText("A look at the numbers.")).toBeInTheDocument();
    expect(screen.getByText(/1 March 2026/)).toBeInTheDocument();
  });

  it("links to the post's own page", () => {
    render(<BlogCard post={post} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/blog/lekki-rents-are-up-again",
    );
  });

  it("shows category chips when present", () => {
    render(<BlogCard post={post} />);
    expect(screen.getByText("Market Trends")).toBeInTheDocument();
  });

  it("omits the cover image entirely when none is set", () => {
    render(<BlogCard post={post} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

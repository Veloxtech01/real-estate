import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamCard from "./TeamCard";

// Vitest does not run the Next compiler — next/link needs stubbing, same as
// PropertyCard.test.jsx.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const agent = {
  _id: "1",
  slug: "adaeze-okonkwo",
  name: "Adaeze Okonkwo",
  position: "Senior Sales Consultant",
  phone: "+2348012345678",
  whatsapp: "2348012345678",
};

describe("TeamCard", () => {
  it("renders the agent's name and position", () => {
    render(<TeamCard agent={agent} />);
    expect(screen.getByText("Adaeze Okonkwo")).toBeInTheDocument();
    expect(screen.getByText("Senior Sales Consultant")).toBeInTheDocument();
  });

  it("links to the agent's own profile page", () => {
    render(<TeamCard agent={agent} />);
    expect(screen.getByRole("link", { name: /view profile/i })).toHaveAttribute(
      "href",
      "/team/adaeze-okonkwo",
    );
  });

  it("shows call and WhatsApp controls built from the agent's own numbers", () => {
    render(<TeamCard agent={agent} />);
    expect(screen.getByRole("link", { name: /call adaeze okonkwo/i })).toHaveAttribute(
      "href",
      "tel:+2348012345678",
    );
    expect(
      screen.getByRole("link", { name: /whatsapp adaeze okonkwo/i }),
    ).toHaveAttribute("href", expect.stringContaining("https://wa.me/2348012345678"));
  });

  it("omits call and WhatsApp controls when the agent has no numbers", () => {
    render(<TeamCard agent={{ ...agent, phone: undefined, whatsapp: undefined }} />);
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  });
});

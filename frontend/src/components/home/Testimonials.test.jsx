import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Testimonials from "./Testimonials";

const items = [
  {
    _id: "1",
    clientName: "Adaeze Okonkwo",
    clientTitle: "Buyer, Lekki",
    quote: "They confirmed the title before we ever booked a viewing.",
  },
  {
    _id: "2",
    clientName: "Chidi Nwosu",
    clientTitle: "Tenant, Ikeja",
    quote: "The rent was quoted per annum with the advance stated up front.",
  },
];

describe("Testimonials", () => {
  it("renders a card per testimonial with the client's name, title and quote", () => {
    render(
      <Testimonials
        eyebrow="What our clients say"
        title="Trusted by discerning clients"
        items={items}
      />,
    );
    expect(screen.getByText("Adaeze Okonkwo")).toBeInTheDocument();
    expect(screen.getByText("Buyer, Lekki")).toBeInTheDocument();
    expect(screen.getByText(/confirmed the title/)).toBeInTheDocument();
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(
      <Testimonials eyebrow="x" title="y" items={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when items is omitted entirely", () => {
    const { container } = render(<Testimonials eyebrow="x" title="y" />);
    expect(container).toBeEmptyDOMElement();
  });
});

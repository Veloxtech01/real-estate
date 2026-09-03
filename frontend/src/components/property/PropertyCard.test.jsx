import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PropertyCard from "./PropertyCard";

// next/image and next/link need stubbing: Vitest does not run the Next compiler.
vi.mock("next/image", () => ({
  // `fill`, `priority` and `sizes` are next/image-only props — swallow them so React
  // does not warn about unknown attributes on a plain <img>.
  default: ({ alt, src, fill: _fill, priority: _priority, sizes: _sizes, ...rest }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === "string" ? src : ""} {...rest} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base = {
  _id: "1",
  slug: "grand-5-bedroom-mansion-ref1009",
  title: "Grand 5 Bedroom Mansion in Akobo",
  listingType: "sale",
  propertyType: "detached",
  status: "available",
  bedrooms: 5,
  bathrooms: 4,
  toilets: 5,
  landSizeSqm: 650,
  price: { currency: "NGN", amount: 127000000, isNegotiable: false, onRequest: false },
  rent: {},
  location: { name: "Akobo", slug: "akobo-oyo", state: "Oyo" },
  coverImage: { url: "https://placehold.co/1200x800", alt: "Front of the house" },
};

describe("PropertyCard", () => {
  it("renders a sale price abbreviated", () => {
    render(<PropertyCard property={base} />);
    expect(screen.getByText("₦127m")).toBeInTheDocument();
  });

  it("renders a rental with its period, not a bare figure", () => {
    render(
      <PropertyCard
        property={{
          ...base,
          listingType: "rent",
          price: { currency: "NGN" },
          rent: { amount: 400000, period: "per_annum" },
        }}
      />,
    );
    expect(screen.getByText("₦400k")).toBeInTheDocument();
    expect(screen.getByText("per year")).toBeInTheDocument();
  });

  it("renders 'Price on request' instead of a zero", () => {
    render(
      <PropertyCard property={{ ...base, price: { currency: "NGN", onRequest: true } }} />,
    );
    expect(screen.getByText("Price on request")).toBeInTheDocument();
    expect(screen.queryByText(/₦0/)).not.toBeInTheDocument();
  });

  it("shows bathrooms and toilets separately — they genuinely differ", () => {
    render(<PropertyCard property={base} />);
    expect(screen.getByText("4 bath")).toBeInTheDocument();
    expect(screen.getByText("5 toilets")).toBeInTheDocument();
  });

  it("survives a listing with no cover image and still labels the image", () => {
    render(<PropertyCard property={{ ...base, coverImage: null }} />);
    expect(screen.getByAltText("Grand 5 Bedroom Mansion in Akobo")).toBeInTheDocument();
  });

  it("labels status with text, not colour alone", () => {
    render(<PropertyCard property={{ ...base, status: "under_offer" }} />);
    expect(screen.getByText("Under offer")).toBeInTheDocument();
  });

  it("links to the SEO listing URL", () => {
    render(<PropertyCard property={base} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/property/grand-5-bedroom-mansion-ref1009",
    );
  });

  it("omits the beds row entirely for land, which has no bedrooms", () => {
    render(
      <PropertyCard
        property={{ ...base, propertyType: "land", bedrooms: 0, bathrooms: 0, toilets: 0 }}
      />,
    );
    expect(screen.queryByText(/bed/)).not.toBeInTheDocument();
  });
});

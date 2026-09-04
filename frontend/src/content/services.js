/**
 * Services-hub copy (§3). One page covering all six services rather than six
 * individual pages — see the design spec's services-scope decision.
 */
const servicesContent = {
  eyebrow: "What we do",
  title: "Property services",
  description: "From a first sale to ongoing management, one team handles it end to end.",
  items: [
    {
      slug: "sales",
      title: "Sales",
      blurb:
        "Verified listings for buyers, and a managed process for sellers — from valuation to closing.",
      href: "/properties?listingType=sale",
    },
    {
      slug: "lettings",
      title: "Lettings",
      blurb:
        "Tenant sourcing, referencing and lease paperwork, with rent quoted per annum and agency fees within the statutory limit.",
      href: "/properties?listingType=rent",
    },
    {
      slug: "property-management",
      title: "Property management",
      blurb:
        "Day-to-day management of tenanted property on the owner's behalf — rent collection, maintenance and tenant relations.",
      href: "/contact",
    },
    {
      slug: "facility-management",
      title: "Facility management",
      blurb:
        "Upkeep of shared infrastructure, security and services across an estate or a commercial building.",
      href: "/contact",
    },
    {
      slug: "valuation",
      title: "Valuation",
      blurb: "An independent opinion of value for a sale, a loan application, or your own records.",
      href: "/contact",
    },
    {
      slug: "land-banking",
      title: "Land banking",
      blurb: "Acquisition of titled land for long-term holding, with title verification handled up front.",
      href: "/contact",
    },
  ],
  cta: {
    title: "Not sure which service you need?",
    body: "Tell us what you're trying to do and we'll point you the right way.",
    action: "Get in touch",
  },
};

export default servicesContent;

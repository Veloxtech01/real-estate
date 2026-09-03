/**
 * Site-wide brand and contact configuration.
 *
 * This is one half of the rebrand seam (scope §9) — the other half is the colour and
 * font tokens in app/globals.css. Copying this repo for a new agency client means
 * editing these two files, not hunting through the component tree.
 *
 * Deliberately local rather than fetched from /api/settings: this build does not
 * require non-technical staff to edit chrome, and the settings write endpoints do not
 * exist. `listingDisclaimer` is the one exception and still comes from the API,
 * because it carries legal exposure (scope §11).
 */
const siteConfig = {
  name: "Ardent Properties",
  legalName: "Ardent Properties Limited",
  tagline: "Homes and land across Nigeria, handled properly.",
  description:
    "A Nigerian real estate agency handling residential and commercial sales, lettings and land across Lagos, Abuja and beyond.",

  // Phone is the primary contact channel in this market — email is secondary.
  phone: "+2348000000000",
  whatsapp: "2348000000000", // digits only, no plus — wa.me link format
  email: "hello@example.com",
  address: "1 Example Road, Lekki Phase 1, Lagos, Nigeria",
  officeHours: ["Mon – Fri: 9:00 – 18:00", "Sat: 10:00 – 16:00"],

  socials: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    twitter: "https://x.com/",
    linkedin: "https://linkedin.com/",
  },

  // Primary navigation. Routes not yet built are intentionally absent rather than
  // linking to a 404 — they get added with their slice.
  nav: [
    { href: "/properties?listingType=sale", label: "Buy" },
    { href: "/properties?listingType=rent", label: "Rent" },
    { href: "/properties", label: "All listings" },
  ],
};

export default siteConfig;

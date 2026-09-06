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

  // Office pin for the contact page map. PLACEHOLDER coordinates (Lekki Phase 1,
  // approximate) — replace with the real office location before a client launch,
  // same status as the demo photography.
  officeCoordinates: { lat: 6.4415, lng: 3.4753 },

  // LASRERA number is a specific credential claim (scope §11) — left null rather
  // than a fabricated-looking placeholder, so the About page simply omits the line
  // until the client supplies the real one. Same reasoning as the homepage's
  // flagged placeholder stats: an invented-but-plausible number is worse than none.
  lasreraNumber: null,
  // Other professional body registrations, e.g. { body: "NIESV", number: "..." }.
  // Empty by default for the same reason lasreraNumber is null.
  registrationNumbers: [],

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
    { href: "/services", label: "Services" },
    { href: "/team", label: "Our team" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],

  // Seller/landlord CTA destination, used by the header and the homepage CTA band.
  // WhatsApp rather than a page: the §3 "list your property" route does not exist yet,
  // and WhatsApp is the channel this market actually replies on. Swap this for the
  // route when that slice lands — nothing else needs editing.
  listPropertyHref:
    "https://wa.me/2348000000000?text=I%20have%20a%20property%20to%20list",

  /*
   * Footer link columns.
   *
   * Every href here must resolve to a route that exists. A footer full of dead links to
   * unbuilt Blog / Guides / FAQ pages looks worse than a short footer, so unbuilt
   * sections are absent, not stubbed. "Property types" are pre-filtered searches, which
   * is a real destination today and stays valid once area pages ship.
   *
   * The `propertyType` values must match the backend enum in utils/constants.js — they
   * are query values, not labels.
   */
  footerLinks: [
    {
      heading: "Explore",
      links: [
        { href: "/properties?listingType=sale", label: "Homes for sale" },
        { href: "/properties?listingType=rent", label: "Homes to let" },
        { href: "/properties?isFeatured=true", label: "Featured listings" },
        { href: "/properties", label: "All listings" },
      ],
    },
    {
      heading: "Property types",
      links: [
        { href: "/properties?propertyType=duplex", label: "Duplexes" },
        { href: "/properties?propertyType=apartment", label: "Flats and apartments" },
        { href: "/properties?propertyType=land", label: "Land" },
        { href: "/properties?propertyType=commercial", label: "Commercial" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About us" },
        { href: "/services", label: "Services" },
        { href: "/team", label: "Meet the team" },
        { href: "/contact", label: "Contact" },
      ],
    },
  ],
};

export default siteConfig;

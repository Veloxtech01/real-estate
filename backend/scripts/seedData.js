/**
 * Baseline content a fresh client copy needs (§9 seed script).
 *
 * This is the "provisions a new client in minutes" payload: taxonomy, location data,
 * default pages and settings. It contains **no demo listings** — those come from the
 * separate demo importer, because a real client copy should start with an empty
 * property list, not 200 invented Lagos duplexes.
 *
 * Copy prose here is deliberately generic placeholder text. It lives in the database
 * (§9), so the client's first act is to edit it in the admin panel, not to ask a
 * developer for a deployment.
 */

/**
 * The single collapsed taxonomy replacing amenities/facilities/features/security
 * (§8.1). Aliases follow §5.4 — these are what a visitor actually types.
 */
export const TAXONOMY_SEED = [
  // --- Amenities ---
  { key: "swimming_pool", name: "Swimming pool", category: "amenity", aliases: ["pool"] },
  { key: "garden", name: "Garden", category: "amenity", aliases: ["green area"] },
  { key: "parking", name: "Parking space", category: "amenity", aliases: ["car park", "parking space"] },
  { key: "air_conditioning", name: "Air conditioning", category: "amenity", aliases: ["ac", "a/c"] },
  { key: "fitted_kitchen", name: "Fitted kitchen", category: "amenity", aliases: ["fitted kitchen"] },
  { key: "walk_in_closet", name: "Walk-in closet", category: "amenity", aliases: ["walk in closet"] },
  { key: "penthouse_unit", name: "Penthouse", category: "amenity", aliases: ["penthouse"] },

  // --- Facilities ---
  { key: "generator", name: "Generator", category: "facility", aliases: ["gen", "standby generator"] },
  { key: "water_supply", name: "Water supply", category: "facility", aliases: ["running water"] },
  { key: "borehole", name: "Borehole", category: "facility", aliases: ["bore hole"] },
  { key: "prepaid_meter", name: "Prepaid meter", category: "facility", aliases: ["prepaid"] },
  { key: "serviced", name: "Serviced", category: "facility", aliases: ["serviced estate", "serviced apartment"] },
  { key: "power_24_7", name: "24/7 power", category: "facility", aliases: ["24 hours power", "constant light"] },

  // --- Security ---
  { key: "gated_estate", name: "Gated estate", category: "security", aliases: ["gated", "estate"] },
  { key: "security_24_7", name: "24 hour security", category: "security", aliases: ["24 hours security", "security"] },
  { key: "cctv", name: "CCTV", category: "security", aliases: ["cameras", "cctv cameras"] },
  { key: "electric_fence", name: "Electric fence", category: "security", aliases: ["electric fencing"] },

  // --- Features ---
  { key: "boys_quarters", name: "Boys' quarters", category: "feature", aliases: ["bq", "boys quarters"] },
  { key: "furnished", name: "Furnished", category: "feature", aliases: ["fully furnished"] },
];

/**
 * Canonical locations. Seeded per state so the rent-rule lookup (§8.2) resolves, and
 * so "Areas we cover" pages (§3) exist from day one.
 *
 * A new client in a different city edits this list — it is starting data, not a
 * fixed national gazetteer.
 */
// Four locations (spread across two states) ship with real copy and isPublished: true,
// so /areas and /areas/[slug] have something genuine to render out of the box — same
// "--demo"-style precedent as the imported listings. Everything else stays unpublished
// until a client (or a direct DB write) supplies its own area copy.
export const LOCATION_SEED = [
  // Lagos
  {
    name: "Lekki Phase 1",
    state: "Lagos",
    lga: "Eti-Osa",
    isPublished: true,
    description:
      "A planned, gated district on Lagos's eastern axis, popular with young professionals and families for its wide roads, private estates and short commute to Victoria Island. New apartment blocks sit alongside established estates, with a growing strip of restaurants, gyms and shopping along the Admiralty Way corridor.",
  },
  {
    name: "Ikoyi",
    state: "Lagos",
    lga: "Eti-Osa",
    isPublished: true,
    description:
      "One of Lagos's oldest high-end residential areas, known for tree-lined streets, embassies and large freestanding houses alongside newer luxury apartment towers. Ikoyi sits close to the island's business district, making it a common choice for executives who want a short commute without leaving a quiet, established neighbourhood.",
  },
  {
    name: "Victoria Island",
    state: "Lagos",
    lga: "Eti-Osa",
    isPublished: true,
    description:
      "Lagos's principal business district, home to corporate headquarters, hotels and a dense mix of apartments alongside the offices. Victoria Island suits tenants and buyers who want to be within walking distance of work, nightlife and the waterfront, trading a quieter setting for constant convenience.",
  },
  { name: "Ajah", state: "Lagos", lga: "Eti-Osa" },
  { name: "Sangotedo", state: "Lagos", lga: "Eti-Osa" },
  { name: "Osapa London", state: "Lagos", lga: "Eti-Osa" },
  { name: "Chevron", state: "Lagos", lga: "Eti-Osa" },
  { name: "Ikeja GRA", state: "Lagos", lga: "Ikeja" },
  { name: "Surulere", state: "Lagos", lga: "Surulere" },
  { name: "Yaba", state: "Lagos", lga: "Lagos Mainland" },

  // Federal Capital Territory
  {
    name: "Maitama",
    state: "Federal Capital Territory",
    lga: "Abuja Municipal",
    isPublished: true,
    description:
      "Abuja's most exclusive district, laid out with wide avenues, low density and some of the capital's largest diplomatic and ministerial residences. Maitama suits buyers and tenants prioritising space, security and proximity to the Central Business District over walkable street life.",
  },
  { name: "Asokoro", state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { name: "Wuse 2", state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { name: "Guzape", state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { name: "Gwarinpa", state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { name: "Jabi", state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { name: "Katampe", state: "Federal Capital Territory", lga: "Abuja Municipal" },
  { name: "Life Camp", state: "Federal Capital Territory", lga: "Abuja Municipal" },

  // Rivers
  { name: "Old GRA", state: "Rivers", lga: "Port Harcourt" },
  { name: "GRA Phase 2", state: "Rivers", lga: "Port Harcourt" },
  { name: "Peter Odili Road", state: "Rivers", lga: "Port Harcourt" },
  { name: "Trans Amadi", state: "Rivers", lga: "Port Harcourt" },
  { name: "Eliozu", state: "Rivers", lga: "Obio-Akpor" },

  // Oyo
  { name: "Bodija", state: "Oyo", lga: "Ibadan North" },
  { name: "Jericho", state: "Oyo", lga: "Ibadan North West" },
  { name: "Oluyole", state: "Oyo", lga: "Oluyole" },
  { name: "Akobo", state: "Oyo", lga: "Lagelu" },
  { name: "Alakia", state: "Oyo", lga: "Egbeda" },

  // Enugu
  { name: "Independence Layout", state: "Enugu", lga: "Enugu East" },
  { name: "New Haven", state: "Enugu", lga: "Enugu North" },
  { name: "GRA", state: "Enugu", lga: "Enugu North" },
  { name: "Thinkers Corner", state: "Enugu", lga: "Enugu North" },
];

/**
 * Location aliases (§5.4) — informal names, abbreviations and misspellings that a
 * visitor types but that match no canonical record.
 *
 * Populated with the client during content loading; this is a starting set, not a
 * complete one. Failed searches (§5.7) are the source for growing it.
 */
export const LOCATION_ALIAS_SEED = [
  { alias: "vi", location: "Victoria Island" },
  { alias: "v.i.", location: "Victoria Island" },
  { alias: "lekki phase one", location: "Lekki Phase 1" },
  { alias: "lekki 1", location: "Lekki Phase 1" },
  { alias: "phase 1", location: "Lekki Phase 1" },
  { alias: "chevy view", location: "Chevron" },
  { alias: "chevron drive", location: "Chevron" },
  { alias: "osapa", location: "Osapa London" },
  { alias: "ikeja gra", location: "Ikeja GRA" },
  { alias: "gra ikeja", location: "Ikeja GRA" },
  { alias: "wuse", location: "Wuse 2" },
  { alias: "port harcourt gra", location: "Old GRA" },
  { alias: "ph gra", location: "Old GRA" },
];

/**
 * Default pages (§4.1, §9).
 *
 * Every piece of visible copy is a section in the database, so the client edits
 * wording without a deployment. The legal pages are placeholders: §11 requires a
 * Nigerian lawyer to review their actual content before launch.
 */
export const PAGE_SEED = [
  {
    key: "home",
    title: "Home",
    isSystem: true,
    publicationState: "published",
    sections: [
      {
        type: "hero",
        order: 0,
        data: {
          headline: "Find your next home",
          subheadline: "Search verified listings across Nigeria.",
          searchPlaceholder: "Try: 3 bedroom flat in Lekki under 100m with parking",
          ctaLabel: "Search properties",
        },
      },
      { type: "featuredProperties", order: 1, data: { heading: "Featured properties", limit: 6 } },
      { type: "servicesSummary", order: 2, data: { heading: "How we can help" } },
      { type: "recentListings", order: 3, data: { heading: "Recently added", limit: 6 } },
      { type: "testimonials", order: 4, data: { heading: "What our clients say" } },
      {
        type: "callToAction",
        order: 5,
        data: {
          headline: "Have a property to let or sell?",
          body: "List it with us and reach serious buyers and tenants.",
          ctaLabel: "List your property",
          ctaHref: "/list-your-property",
        },
      },
    ],
  },
  {
    key: "about",
    slug: "about",
    title: "About us",
    isSystem: true,
    publicationState: "published",
    sections: [
      {
        type: "richText",
        order: 0,
        data: {
          heading: "About the agency",
          // Placeholder — the client supplies history, credentials and years in
          // operation, and their LASRERA number is rendered from Settings.
          body: "Tell visitors who you are, how long you have been operating, and what you are known for.",
        },
      },
    ],
  },
  {
    key: "list_property",
    slug: "list-your-property",
    title: "List your property with us",
    isSystem: true,
    publicationState: "published",
    sections: [
      {
        type: "richText",
        order: 0,
        data: {
          // §3 calls this the agency's supply pipeline and arguably the most
          // commercially valuable page on the site.
          heading: "List your property with us",
          body: "Tell us about your property and we will get back to you within one working day.",
        },
      },
      { type: "listPropertyForm", order: 1, data: {} },
    ],
  },
  {
    key: "contact",
    slug: "contact",
    title: "Contact us",
    isSystem: true,
    publicationState: "published",
    sections: [
      { type: "contactDetails", order: 0, data: { heading: "Get in touch" } },
      { type: "enquiryForm", order: 1, data: {} },
      { type: "map", order: 2, data: {} },
    ],
  },
  {
    key: "legal.terms",
    slug: "terms",
    title: "Terms of use",
    isSystem: true,
    publicationState: "draft",
    sections: [
      {
        type: "richText",
        order: 0,
        data: {
          heading: "Terms of use",
          // Left as draft on purpose: publishing unreviewed legal copy is worse than
          // publishing none (§11).
          body: "PLACEHOLDER — must be drafted and reviewed by a Nigerian lawyer before launch.",
        },
      },
    ],
  },
  {
    key: "legal.privacy",
    slug: "privacy",
    title: "Privacy notice",
    isSystem: true,
    publicationState: "draft",
    sections: [
      {
        type: "richText",
        order: 0,
        data: {
          heading: "Privacy notice",
          // NDPA 2023 (§11): the site collects enquirer names, phone numbers and
          // email addresses, so this page is a legal requirement, not boilerplate.
          body: "PLACEHOLDER — must cover NDPA 2023 obligations and be reviewed by a Nigerian lawyer.",
        },
      },
    ],
  },
  {
    key: "legal.disclaimer",
    slug: "listing-disclaimer",
    title: "Listing disclaimer",
    isSystem: true,
    publicationState: "draft",
    sections: [
      {
        type: "richText",
        order: 0,
        data: {
          heading: "Listing disclaimer",
          body: "PLACEHOLDER — the agency does not warrant title; buyers must conduct independent legal searches.",
        },
      },
    ],
  },
  {
    key: "legal.cookies",
    slug: "cookies",
    title: "Cookie notice",
    isSystem: true,
    publicationState: "draft",
    sections: [
      { type: "richText", order: 0, data: { heading: "Cookie notice", body: "PLACEHOLDER." } },
    ],
  },
];

/**
 * Default settings for a fresh copy.
 *
 * Brand values are neutral placeholders — §9 requires that no client's colours or
 * name ever live in code, and that includes seed code. AI search is off by default:
 * it costs money per call and must be switched on deliberately (§5.6).
 */
export const SETTINGS_SEED = {
  agencyName: "Your Agency Name",
  tagline: "Property sales, lettings and management",
  theme: {
    colors: {
      primary: "#0f172a",
      accent: "#0ea5e9",
      surface: "#ffffff",
      muted: "#f1f5f9",
    },
    fontHeading: "system-ui",
    fontBody: "system-ui",
    homepageVariant: "default",
  },
  aiSearch: {
    enabled: false,
    monthlySpendCapUsd: 0,
    currentSpendUsd: 0,
    timeoutMs: 2000,
  },
  listingDisclaimer:
    "The agency does not warrant title to any property listed. Prospective buyers must conduct independent legal searches.",
};

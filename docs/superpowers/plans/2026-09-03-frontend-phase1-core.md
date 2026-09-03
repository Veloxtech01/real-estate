# Frontend Phase 1 Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the visitor-facing lead-generation path of the real estate site — app shell, homepage, property search results, and property detail with enquiry capture — against the already-built public API.

**Architecture:** Next.js 16 App Router. Pages are async Server Components that read `params`/`searchParams` (both Promises in Next 16) and fetch through a single server-side data module using `fetch` with `next: { revalidate }`. Interactive leaves (filter panel, gallery, forms, map, mobile nav) are Client Components. URL search params are the sole source of truth for search state. All site copy and brand values are local to the repo in `src/config/site.js` and `src/content/`, not fetched from the database.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2, Tailwind CSS v4 (CSS-first `@theme`), Axios, react-hook-form, react-hot-toast, react-icons, motion, leaflet + react-leaflet (new), Vitest + Testing Library.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Read Next 16 docs before writing Next-specific code.** `frontend/node_modules/next/dist/docs/01-app/`. Next 16 differs from Next 13/14/15 training data. Confirmed facts you may rely on: `params` and `searchParams` are **Promises** and must be awaited; `fetch` is **not cached by default**; `next: { revalidate: N }` is the caching mechanism (Cache Components / `use cache` is **not** enabled in this project and must not be enabled by this plan).
- **Tailwind v4, not v3.** There is no `tailwind.config.js`. Theme customization is `@theme` inside `frontend/src/app/globals.css`.
- **React 19.** No `import React` for JSX. `ref` is a plain prop; do not use `forwardRef`.
- **Every function, component, hook and non-obvious branch gets a comment** explaining *why*, per CLAUDE.md. Comment JSX layout regions, conditional renders and mapped lists.
- **Response envelope is `{ success: true, data }` / `{ success: false, message, details? }`.** Unwrap it in exactly one place per client. No call site handles a third shape.
- **No brand colour, font, logo, or the agency name may be hardcoded in a component.** Colours come from CSS custom properties in `globals.css`; everything else from `src/config/site.js`.
- **No new dependencies beyond `leaflet` and `react-leaflet`**, which are pre-approved by this plan. Anything else must be flagged before installing.
- **Never `if (property.price)`** — `price` is always truthy. Check `price.amount != null`. Sale reads `price.amount`; rent reads `rent.amount`; `rent.period` defaults to `per_annum`.
- **Prices render abbreviated** (`₦150m`, `₦1.2b`), never `₦150,000,000`. `price.currency` may be `USD`.
- **`bathrooms` and `toilets` are separate counts.** Show both.
- **Use `<Link>` for internal navigation**, never a raw `<a href>`.
- **Icons:** `react-icons/fi` only, imported per icon. No emoji as icons.
- **Accessibility floors:** 4.5:1 text contrast, visible `focus-visible` ring, ≥44×44px touch targets, real `<label for>` on every input, `aria-label` on icon-only buttons, `prefers-reduced-motion` respected.
- **Lint and test after every task:** `npm run lint` and `npm test` inside `frontend/` must both pass before committing.
- **Design system reference:** `docs/DESIGN-SYSTEM.md`. Spec: `docs/superpowers/specs/2026-09-03-frontend-phase1-core-design.md`. API contract: `docs/API-REFERENCE.md`.

### Environment

`frontend/.env.local` must contain:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The backend runs on port 5000 (`cd backend && npm run dev`), the frontend on 3000. The dev database `realestate_dev` is seeded with 200 demo listings.

> **Known dev-data limitation:** demo listing images are `https://placehold.co/1200x800?...` placeholders, not real photography. The UI will be built and reviewed against grey boxes. This is a data problem, not a layout problem — do not compensate by shrinking image areas.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/config/site.js` | Agency name, contact details, socials, nav items, WhatsApp number — the rebrand seam |
| `src/content/home.js` | Homepage copy (hero, section headings, trust points) |
| `src/lib/format.js` | `formatPrice`, `formatArea`, `formatRentPeriod`, `humanise` — pure display helpers |
| `src/lib/property.js` | `priceOf`, `isRental`, `coverImageOf`, `statusLabel` — the API gotcha guards |
| `src/lib/searchParams.js` | URL ⇄ filter object, both directions |
| `src/lib/api/server.js` | Server-side data layer (`fetch` + `revalidate`) |
| `src/lib/api/client.js` | Shared Axios instance for browser writes |
| `src/lib/seo.js` | Metadata builders and JSON-LD helpers |
| `src/components/ui/*` | Button, Input, Select, Badge, Skeleton, Container, Section |
| `src/components/layout/*` | Header, MobileNav, Footer |
| `src/components/property/*` | PropertyCard, PropertyGrid, PropertyGallery, KeyFacts, AmenityList, AgentCard, PropertyMap |
| `src/components/search/*` | SearchBar, FilterPanel, FilterChips, SortSelect, Pagination, RelaxationNotice, EmptyResults |
| `src/components/forms/*` | EnquiryForm, ViewingRequestForm, FieldError |
| `src/app/properties/page.js` | Search results route |
| `src/app/property/[slug]/page.js` | Property detail route |
| `src/app/sitemap.js`, `src/app/robots.js` | SEO file conventions |

**Modified:** `src/app/globals.css`, `src/app/layout.js`, `src/app/page.js`, `next.config.mjs`.

---

## Task 1: Theme foundation and site config

**Files:**
- Modify: `frontend/src/app/globals.css` (full rewrite)
- Modify: `frontend/src/app/layout.js`
- Modify: `frontend/next.config.mjs`
- Create: `frontend/src/config/site.js`
- Create: `frontend/.env.local`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--color-ink`, `--color-ink-soft`, `--color-muted`, `--color-accent`, `--color-accent-text`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-success`, `--color-warning`, `--color-danger` — usable as Tailwind utilities `bg-ink`, `text-muted`, `border-border`, etc. Font variables `--font-display` (Playfair Display) and `--font-sans` (Inter). `siteConfig` default export from `@/config/site` with shape `{ name, tagline, legalName, phone, whatsapp, email, address, officeHours, socials: {facebook,instagram,twitter,linkedin}, nav: [{href,label}] }`.

- [ ] **Step 1: Create `frontend/.env.local`**

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Rewrite `frontend/src/app/globals.css`**

Replaces the `create-next-app` defaults entirely. The `prefers-color-scheme` dark block is removed deliberately — dark mode is out of scope and a half-done dark mode looks worse than none.

```css
@import "tailwindcss";

/*
 * THE REBRAND SEAM (scope §9).
 * Every brand colour and font in the product resolves to a variable defined here.
 * Rebranding a copied repo means editing this block and src/config/site.js — nothing else.
 * No component may hardcode a hex value.
 */
@theme {
  /* Warm near-black. Headings, primary buttons, footer ground. */
  --color-ink: #1c1917;
  /* Secondary text, meta lines, field labels. */
  --color-ink-soft: #44403c;
  /* Tertiary text. ~4.9:1 on --color-surface — the lightest text permitted. */
  --color-muted: #78716c;
  /* Gold accent. ~3.3:1 on surface, so: rules, borders, icon fills, large display
     type and hover states ONLY. Never small text. */
  --color-accent: #ca8a04;
  /* The AA-safe gold (~4.6:1). Any gold *text* uses this instead. */
  --color-accent-text: #a16207;
  /* Page ground — warm off-white, not pure white. */
  --color-surface: #fafaf9;
  /* Cards, panels, sheets. */
  --color-surface-raised: #ffffff;
  --color-border: #e7e5e4;
  --color-text: #0c0a09;
  /* Listing status colours. Always paired with a text label — never colour alone. */
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-danger: #b91c1c;

  /* Bound to next/font variables in layout.js. Playfair is display-only. */
  --font-display: var(--font-playfair), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;

  /* Single container width for the whole site (design system §4). */
  --spacing-container: 80rem;
}

/*
 * Z-index scale. Defined once so nothing invents an ad-hoc 9999.
 * 10 sticky bars · 20 dropdowns/filter sheet · 30 header · 40 lightbox · 50 toasts
 */
:root {
  --z-sticky: 10;
  --z-dropdown: 20;
  --z-header: 30;
  --z-lightbox: 40;
  --z-toast: 50;
}

body {
  background-color: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-sans);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

/* Display face is opt-in via .font-display; it must never leak into forms or data. */
h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: -0.02em;
  line-height: 1.15;
}

/* Prices and spec counts align in a grid only with tabular figures. */
.tabular {
  font-variant-numeric: tabular-nums;
}

/* One focus treatment for the entire site. */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Honour the OS motion preference globally rather than per-animation. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Create `frontend/src/config/site.js`**

```js
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
```

- [ ] **Step 4: Rewrite `frontend/src/app/layout.js`**

```js
import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import siteConfig from "@/config/site";

/**
 * Fonts are self-hosted through next/font (zero layout shift, no external request to
 * Google). Variable weights only — one file each, not one per weight.
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Title template gives every child page "<page> — <agency>" without repeating the name.
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

/**
 * Root layout. Holds the font variables, the global toast portal, and (from Task 5)
 * the site header and footer.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Single toast portal for the whole app — components call toast() directly. */}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Update `frontend/next.config.mjs` for remote images**

`next/image` refuses hosts that aren't allow-listed. `placehold.co` covers the seeded demo data; `res.cloudinary.com` covers real uploads once the media endpoint exists.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // next/image blocks any host not listed here. placehold.co serves the seeded demo
    // listings; Cloudinary will serve real uploads once media upload is built.
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 6: Verify the app still builds and lints**

Run: `cd frontend && npm run lint && npm run build`
Expected: lint silent, build succeeds. If the build complains about a missing font, confirm network access to Google Fonts at build time.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/app/layout.js frontend/src/config/site.js frontend/next.config.mjs
git commit -m "feat(frontend): theme tokens, fonts, and site config seam"
```

---

## Task 2: Display formatting helpers

**Files:**
- Create: `frontend/src/lib/format.js`
- Test: `frontend/src/lib/format.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatMoney(amount: number, currency: string) => string` — abbreviated, e.g. `"₦150m"`.
  - `formatArea(sqm: number|null) => string|null` — e.g. `"500 m²"`.
  - `formatRentPeriod(period: string) => string` — `"per_annum"` → `"per year"`.
  - `humanise(key: string) => string` — `"self_contained"` → `"Self-contained"`.
  - `formatCount(n: number, singular: string) => string` — `"3 bedrooms"`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/format.test.js`:

```js
import { describe, it, expect } from "vitest";
import { formatMoney, formatArea, formatRentPeriod, humanise, formatCount } from "./format";

describe("formatMoney", () => {
  it("abbreviates millions the way Nigerian buyers read prices", () => {
    expect(formatMoney(150000000, "NGN")).toBe("₦150m");
  });

  it("keeps one decimal place when it carries information", () => {
    expect(formatMoney(127500000, "NGN")).toBe("₦127.5m");
  });

  it("drops a trailing .0", () => {
    expect(formatMoney(127000000, "NGN")).toBe("₦127m");
  });

  it("abbreviates billions", () => {
    expect(formatMoney(1200000000, "NGN")).toBe("₦1.2b");
  });

  it("abbreviates thousands", () => {
    expect(formatMoney(400000, "NGN")).toBe("₦400k");
  });

  it("prints small amounts in full", () => {
    expect(formatMoney(950, "NGN")).toBe("₦950");
  });

  it("never assumes naira — USD stock exists", () => {
    expect(formatMoney(2500000, "USD")).toBe("$2.5m");
  });

  it("falls back to the code for an unknown currency", () => {
    expect(formatMoney(5000000, "GBP")).toBe("GBP 5m");
  });
});

describe("formatArea", () => {
  it("renders square metres, the only unit the API stores", () => {
    expect(formatArea(500)).toBe("500 m²");
  });

  it("returns null when there is no land size, so callers can omit the row", () => {
    expect(formatArea(null)).toBeNull();
    expect(formatArea(undefined)).toBeNull();
  });
});

describe("formatRentPeriod", () => {
  it("expands per_annum — the Nigerian default that a naive render gets wrong by 12x", () => {
    expect(formatRentPeriod("per_annum")).toBe("per year");
  });

  it("handles quarter and month", () => {
    expect(formatRentPeriod("per_quarter")).toBe("per quarter");
    expect(formatRentPeriod("per_month")).toBe("per month");
  });

  it("degrades gracefully on an unknown period rather than throwing", () => {
    expect(formatRentPeriod("per_fortnight")).toBe("per fortnight");
  });
});

describe("humanise", () => {
  it("turns a machine key into a label, since the API deliberately sends no labels", () => {
    expect(humanise("self_contained")).toBe("Self-contained");
    expect(humanise("boys_quarters")).toBe("Boys quarters");
  });

  it("uses the curated label where a naive transform would be wrong", () => {
    expect(humanise("c_of_o")).toBe("C of O");
    expect(humanise("governors_consent")).toBe("Governor's Consent");
  });

  it("returns an empty string for a missing key", () => {
    expect(humanise(undefined)).toBe("");
  });
});

describe("formatCount", () => {
  it("pluralises", () => {
    expect(formatCount(1, "bedroom")).toBe("1 bedroom");
    expect(formatCount(3, "bedroom")).toBe("3 bedrooms");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/format.test.js`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/format.js`:

```js
/**
 * Pure display formatters. No API shapes leak in here — callers pass primitives.
 * Everything the visitor reads as a number goes through this module so the Nigerian
 * conventions (abbreviated prices, square metres, per-annum rent) live in one place.
 */

// Symbols for the currencies the API can emit. Anything else falls back to the code,
// which is honest rather than wrong.
const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$" };

// Keys whose human label a naive underscore-to-space transform would get wrong.
const LABEL_OVERRIDES = {
  c_of_o: "C of O",
  global_c_of_o: "Global C of O",
  governors_consent: "Governor's Consent",
  deed_of_assignment: "Deed of Assignment",
  registered_survey: "Registered Survey",
  boys_quarters: "Boys quarters",
  self_contained: "Self-contained",
  room_and_parlour: "Room and parlour",
  mini_flat: "Mini flat",
  semi_detached: "Semi-detached",
  per_annum: "per year",
  per_quarter: "per quarter",
  per_month: "per month",
};

/**
 * Strip a trailing ".0" so 127.0m renders as 127m.
 * Kept separate because every magnitude branch needs it.
 */
function trimDecimal(value) {
  return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * Format an amount the way Nigerian buyers read prices: "₦150m", not "₦150,000,000"
 * (scope §8.2). Never assumes naira — high-end stock is priced in USD.
 *
 * @param {number} amount
 * @param {string} currency - ISO code from the API (`price.currency`).
 * @returns {string}
 */
export function formatMoney(amount, currency = "NGN") {
  const symbol = CURRENCY_SYMBOLS[currency];
  // An unknown currency gets "GBP 5m" — a wrong symbol would misprice the listing.
  const prefix = symbol ?? `${currency} `;

  if (amount >= 1_000_000_000) return `${prefix}${trimDecimal(amount / 1_000_000_000)}b`;
  if (amount >= 1_000_000) return `${prefix}${trimDecimal(amount / 1_000_000)}m`;
  if (amount >= 1_000) return `${prefix}${trimDecimal(amount / 1_000)}k`;
  // Below a thousand, abbreviating loses information rather than saving space.
  return `${prefix}${amount}`;
}

/**
 * Render a land or floor area. The API stores square metres only — a "plot" means a
 * different area in different parts of Lagos, so we never convert back to plots.
 *
 * @returns {string|null} null when there is no area, so the caller omits the row.
 */
export function formatArea(sqm) {
  if (sqm == null) return null;
  return `${sqm.toLocaleString("en-NG")} m²`;
}

/**
 * Expand a rent period key. `per_annum` is the schema default and the Nigerian norm;
 * rendering it as "/month" understates the rent by twelve times.
 */
export function formatRentPeriod(period) {
  return LABEL_OVERRIDES[period] ?? String(period ?? "").replace(/_/g, " ");
}

/**
 * Turn an API machine key into a human label. The API deliberately sends keys, not
 * labels, so that wording stays a presentation concern.
 */
export function humanise(key) {
  if (!key) return "";
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Count with a naively pluralised noun — adequate for beds/baths/toilets. */
export function formatCount(n, singular) {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/format.test.js`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/format.js frontend/src/lib/format.test.js
git commit -m "feat(frontend): naira-aware display formatters"
```

---

## Task 3: Property data guards

**Files:**
- Create: `frontend/src/lib/property.js`
- Test: `frontend/src/lib/property.test.js`

Every gotcha in `docs/API-REFERENCE.md` is neutralised here so no component re-implements it.

**Interfaces:**
- Consumes: `formatMoney`, `formatRentPeriod` from `@/lib/format`.
- Produces:
  - `isRental(property) => boolean`
  - `priceOf(property) => { label: string, suffix: string|null, isOnRequest: boolean, isNegotiable: boolean }`
  - `coverImageOf(property) => { url: string, alt: string, isPlaceholder: boolean }`
  - `statusLabel(status) => { label: string, tone: "success"|"warning"|"danger"|"muted" }`
  - `propertyPath(property) => string` — `/property/<slug>`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/property.test.js`:

```js
import { describe, it, expect } from "vitest";
import { isRental, priceOf, coverImageOf, statusLabel, propertyPath } from "./property";

// A sale listing: figure lives on price.amount.
const saleListing = {
  slug: "grand-5-bedroom-mansion-ref1009",
  title: "Grand 5 Bedroom Mansion",
  listingType: "sale",
  status: "available",
  price: { currency: "NGN", amount: 127000000, isNegotiable: false, onRequest: false },
  rent: {},
  coverImage: { url: "https://placehold.co/1200x800", alt: "Front elevation" },
};

// A rent listing: price is present but has NO amount — the classic trap.
const rentListing = {
  slug: "3-bed-flat-akobo-ref1010",
  title: "3 Bedroom Flat",
  listingType: "rent",
  status: "available",
  price: { currency: "NGN", isNegotiable: false, onRequest: false },
  rent: { amount: 400000, period: "per_annum", advanceYears: 1 },
  coverImage: { url: "https://placehold.co/1200x800", alt: "Living room" },
};

describe("isRental", () => {
  it("reads listingType, not the presence of a rent object", () => {
    expect(isRental(rentListing)).toBe(true);
    expect(isRental(saleListing)).toBe(false);
  });
});

describe("priceOf", () => {
  it("reads price.amount for a sale", () => {
    expect(priceOf(saleListing)).toMatchObject({ label: "₦127m", suffix: null });
  });

  it("reads rent.amount for a rental and states the period explicitly", () => {
    expect(priceOf(rentListing)).toMatchObject({ label: "₦400k", suffix: "per year" });
  });

  it("does NOT treat a truthy price object with no amount as a price", () => {
    // The single most dangerous shape in the API: price is always truthy.
    const result = priceOf({ ...saleListing, price: { currency: "NGN" }, rent: {} });
    expect(result.label).toBe("Price on request");
    expect(result.label).not.toContain("0");
  });

  it("renders 'Price on request' as a real state, never ₦0", () => {
    const onRequest = { ...saleListing, price: { currency: "NGN", onRequest: true } };
    expect(priceOf(onRequest)).toMatchObject({ label: "Price on request", isOnRequest: true });
  });

  it("flags a negotiable price so the UI can badge it", () => {
    const negotiable = {
      ...saleListing,
      price: { ...saleListing.price, isNegotiable: true },
    };
    expect(priceOf(negotiable).isNegotiable).toBe(true);
  });

  it("respects USD pricing", () => {
    const usd = { ...saleListing, price: { currency: "USD", amount: 2500000 } };
    expect(priceOf(usd).label).toBe("$2.5m");
  });
});

describe("coverImageOf", () => {
  it("uses the cover image when present", () => {
    expect(coverImageOf(saleListing)).toMatchObject({
      url: "https://placehold.co/1200x800",
      isPlaceholder: false,
    });
  });

  it("falls back to a local placeholder rather than a broken frame", () => {
    const result = coverImageOf({ ...saleListing, coverImage: null });
    expect(result.isPlaceholder).toBe(true);
    expect(result.url).toBe("/placeholder-property.svg");
  });

  it("derives alt text from the title when the media record has none", () => {
    const result = coverImageOf({
      ...saleListing,
      coverImage: { url: "https://placehold.co/1200x800" },
    });
    expect(result.alt).toBe("Grand 5 Bedroom Mansion");
  });
});

describe("statusLabel", () => {
  it("always returns a text label, so status is never colour-only", () => {
    expect(statusLabel("available")).toEqual({ label: "Available", tone: "success" });
    expect(statusLabel("under_offer")).toEqual({ label: "Under offer", tone: "warning" });
    expect(statusLabel("sold")).toEqual({ label: "Sold", tone: "danger" });
    expect(statusLabel("rented")).toEqual({ label: "Rented", tone: "danger" });
    expect(statusLabel("off_market")).toEqual({ label: "Off market", tone: "muted" });
  });
});

describe("propertyPath", () => {
  it("builds the SEO listing URL from the API slug", () => {
    expect(propertyPath(saleListing)).toBe("/property/grand-5-bedroom-mansion-ref1009");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/property.test.js`
Expected: FAIL — `Failed to resolve import "./property"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/property.js`:

```js
import { formatMoney, formatRentPeriod } from "@/lib/format";

/**
 * Guards around the property shape returned by the API.
 *
 * Every rule here exists because the raw shape has a trap in it (see the "Gotchas"
 * section of docs/API-REFERENCE.md). Components must go through these helpers rather
 * than reading `property.price` and friends directly.
 */

// Status key -> label + tone. Tone maps to a colour token; the label always renders,
// so status is never communicated by colour alone.
const STATUS = {
  available: { label: "Available", tone: "success" },
  under_offer: { label: "Under offer", tone: "warning" },
  sold: { label: "Sold", tone: "danger" },
  rented: { label: "Rented", tone: "danger" },
  off_market: { label: "Off market", tone: "muted" },
};

const PLACEHOLDER_IMAGE = "/placeholder-property.svg";

/** True when the listing is a letting. Reads listingType — the authoritative field. */
export function isRental(property) {
  return property?.listingType === "rent";
}

/**
 * Resolve what to display where the price goes.
 *
 * The trap: `price` is ALWAYS a truthy object because of schema defaults, even on a
 * rental where the figure lives on `rent.amount`. `if (property.price)` therefore
 * always passes and renders nothing useful. We check `amount != null` instead.
 *
 * @returns {{label: string, suffix: string|null, isOnRequest: boolean, isNegotiable: boolean}}
 */
export function priceOf(property) {
  const rental = isRental(property);
  const source = rental ? property?.rent : property?.price;
  const currency = property?.price?.currency ?? "NGN";
  const isNegotiable = Boolean(property?.price?.isNegotiable);
  const explicitlyOnRequest = Boolean(property?.price?.onRequest);

  // A published listing with no figure at all is a legitimate state (§8.2), not
  // missing data — say so rather than rendering ₦0 or hiding the listing.
  if (explicitlyOnRequest || source?.amount == null) {
    return { label: "Price on request", suffix: null, isOnRequest: true, isNegotiable };
  }

  return {
    label: formatMoney(source.amount, currency),
    // Rent is per annum by default. Always stating the period stops a reader
    // assuming monthly and undercounting the rent by twelve times.
    suffix: rental ? formatRentPeriod(source.period ?? "per_annum") : null,
    isOnRequest: false,
    isNegotiable,
  };
}

/**
 * Resolve the card/hero image. `coverImage` and its `alt`/`blurDataUrl`/dimensions are
 * frequently absent on real data, so every consumer would otherwise need the same
 * guard. A designed placeholder beats a broken frame.
 */
export function coverImageOf(property) {
  const cover = property?.coverImage;
  if (!cover?.url) {
    return { url: PLACEHOLDER_IMAGE, alt: property?.title ?? "Property", isPlaceholder: true };
  }
  return {
    url: cover.url,
    // Fall back to the listing title so a meaningful image is never left unlabelled.
    alt: cover.alt || property?.title || "Property",
    isPlaceholder: false,
  };
}

/** Label + tone for a listing status. Unknown statuses degrade to a muted label. */
export function statusLabel(status) {
  return STATUS[status] ?? { label: "Unavailable", tone: "muted" };
}

/** The SEO listing URL. The slug is built by the API — never re-derive it here. */
export function propertyPath(property) {
  return `/property/${property.slug}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/property.test.js`
Expected: PASS.

- [ ] **Step 5: Create the placeholder graphic**

Create `frontend/public/placeholder-property.svg` — a local decorative asset (design system §5: local, not DB).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-hidden="true">
  <rect width="1200" height="800" fill="#f5f5f4"/>
  <g fill="none" stroke="#d6d3d1" stroke-width="8" stroke-linejoin="round">
    <path d="M420 470 L600 330 L780 470"/>
    <path d="M460 450 L460 610 L740 610 L740 450"/>
    <path d="M560 610 L560 520 L640 520 L640 610"/>
  </g>
  <text x="600" y="700" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" fill="#a8a29e">Photo coming soon</text>
</svg>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/property.js frontend/src/lib/property.test.js frontend/public/placeholder-property.svg
git commit -m "feat(frontend): property shape guards for the API gotchas"
```

---

## Task 4: Search param serialisation

**Files:**
- Create: `frontend/src/lib/searchParams.js`
- Test: `frontend/src/lib/searchParams.test.js`

The URL is the single source of truth for search state. This module is the only place that knows the parameter vocabulary.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `FILTER_KEYS: string[]`
  - `parseSearchParams(raw: object) => object` — from `await searchParams` to a clean filter object.
  - `toQueryString(filters: object) => string` — no leading `?`.
  - `withFilter(filters, key, value) => object` — immutable set; `null`/`undefined`/`""` removes the key and resets `page`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/searchParams.test.js`:

```js
import { describe, it, expect } from "vitest";
import { parseSearchParams, toQueryString, withFilter } from "./searchParams";

describe("parseSearchParams", () => {
  it("passes through the supported scalar filters", () => {
    expect(parseSearchParams({ listingType: "rent", location: "lekki" })).toEqual({
      listingType: "rent",
      location: "lekki",
    });
  });

  it("coerces numeric filters to numbers so the API isn't sent strings", () => {
    expect(parseSearchParams({ bedroomsMin: "3", priceMax: "200000000" })).toEqual({
      bedroomsMin: 3,
      priceMax: 200000000,
    });
  });

  it("drops a numeric filter that isn't a number rather than passing NaN on", () => {
    expect(parseSearchParams({ bedroomsMin: "many" })).toEqual({});
  });

  it("normalises amenities to an array whether one or many were selected", () => {
    expect(parseSearchParams({ amenities: "swimming_pool" }).amenities).toEqual(["swimming_pool"]);
    expect(parseSearchParams({ amenities: ["swimming_pool", "gym"] }).amenities).toEqual([
      "swimming_pool",
      "gym",
    ]);
  });

  it("rejects unknown keys — the URL must not become an open pipe to the API", () => {
    expect(parseSearchParams({ listingType: "sale", isFeatured: "true", evil: "1" })).toEqual({
      listingType: "sale",
      isFeatured: "true",
    });
  });

  it("keeps the free-text query", () => {
    expect(parseSearchParams({ q: "3 bedroom flat in Lekki" }).q).toBe("3 bedroom flat in Lekki");
  });

  it("defaults nothing — an empty URL means an unfiltered search", () => {
    expect(parseSearchParams({})).toEqual({});
  });
});

describe("toQueryString", () => {
  it("round-trips a parsed filter object", () => {
    const filters = { listingType: "rent", bedroomsMin: 3, amenities: ["gym", "pool"] };
    const parsedBack = parseSearchParams(
      Object.fromEntries(
        (() => {
          const params = new URLSearchParams(toQueryString(filters));
          const out = {};
          for (const key of params.keys()) {
            const all = params.getAll(key);
            out[key] = all.length > 1 ? all : all[0];
          }
          return Object.entries(out);
        })(),
      ),
    );
    expect(parsedBack).toEqual(filters);
  });

  it("omits empty values instead of emitting bare keys", () => {
    expect(toQueryString({ listingType: "", bedroomsMin: 3 })).toBe("bedroomsMin=3");
  });

  it("repeats the key for array values", () => {
    expect(toQueryString({ amenities: ["gym", "pool"] })).toBe("amenities=gym&amenities=pool");
  });
});

describe("withFilter", () => {
  it("sets a value without mutating the original", () => {
    const before = { listingType: "rent" };
    const after = withFilter(before, "bedroomsMin", 3);
    expect(after).toEqual({ listingType: "rent", bedroomsMin: 3 });
    expect(before).toEqual({ listingType: "rent" });
  });

  it("removes the key when the value is cleared", () => {
    expect(withFilter({ listingType: "rent", bedroomsMin: 3 }, "bedroomsMin", null)).toEqual({
      listingType: "rent",
    });
  });

  it("resets pagination, because page 4 of the old filter is meaningless", () => {
    expect(withFilter({ page: 4 }, "listingType", "sale")).toEqual({ listingType: "sale" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/searchParams.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/searchParams.js`:

```js
/**
 * URL <-> filter-object translation.
 *
 * The URL is the single source of truth for search state (spec §2.4): it makes a
 * search shareable, indexable, and correct under browser back/forward. This module is
 * the only place that knows which query parameters exist, so an unknown key in the URL
 * can never reach the API.
 */

// Filters passed through as strings, exactly as GET /api/properties expects them.
const STRING_KEYS = [
  "listingType",
  "propertyType",
  "location",
  "state",
  "titleType",
  "isFeatured",
  "q",
  "sort",
];

// Filters coerced to numbers. A non-numeric value is dropped, never forwarded as NaN.
const NUMBER_KEYS = [
  "bedroomsMin",
  "bedroomsMax",
  "bathroomsMin",
  "priceMin",
  "priceMax",
  "page",
  "limit",
];

// Filters that may appear more than once in the URL.
const ARRAY_KEYS = ["amenities"];

export const FILTER_KEYS = [...STRING_KEYS, ...NUMBER_KEYS, ...ARRAY_KEYS];

/**
 * Turn Next's resolved `searchParams` object into a clean filter object.
 * Unknown keys are discarded — this is the whitelist boundary for the URL.
 *
 * @param {Record<string, string|string[]|undefined>} raw
 * @returns {object}
 */
export function parseSearchParams(raw = {}) {
  const filters = {};

  for (const key of STRING_KEYS) {
    const value = raw[key];
    // Next gives an array if the key repeats; take the first for a scalar filter.
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar) filters[key] = scalar;
  }

  for (const key of NUMBER_KEYS) {
    const value = raw[key];
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar == null || scalar === "") continue;
    const parsed = Number(scalar);
    // Dropping a malformed number is safer than sending NaN into a DB query.
    if (Number.isFinite(parsed)) filters[key] = parsed;
  }

  for (const key of ARRAY_KEYS) {
    const value = raw[key];
    if (value == null || value === "") continue;
    filters[key] = Array.isArray(value) ? value : [value];
  }

  return filters;
}

/**
 * Serialise a filter object back to a query string (no leading "?").
 * Empty values are omitted so the URL never carries bare keys.
 */
export function toQueryString(filters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      // Repeat the key per item — matches what parseSearchParams expects back.
      for (const item of value) if (item) params.append(key, String(item));
      continue;
    }
    params.set(key, String(value));
  }

  return params.toString();
}

/**
 * Immutably set or clear one filter.
 *
 * Always resets `page`: staying on page 4 after changing a filter shows an empty or
 * unrelated result set, which reads as a broken search.
 */
export function withFilter(filters, key, value) {
  const next = { ...filters };
  delete next.page;

  const isEmpty =
    value == null || value === "" || (Array.isArray(value) && value.length === 0);
  if (isEmpty) delete next[key];
  else next[key] = value;

  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/searchParams.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/searchParams.js frontend/src/lib/searchParams.test.js
git commit -m "feat(frontend): URL search param whitelist and serialisation"
```

---

## Task 5: Data layer — server fetch module and Axios client

**Files:**
- Create: `frontend/src/lib/api/server.js`
- Create: `frontend/src/lib/api/client.js`

**Interfaces:**
- Consumes: `toQueryString` from `@/lib/searchParams`.
- Produces (server): `getProperties(filters)`, `getProperty(slug)`, `getFeatured(limit)`, `getFilters()`, `getLocations(params)`, `getLocation(slug)`, `getSettings()`, `naturalSearch(body)`. Each returns the unwrapped `data` object, or `null` on a 404, and throws on other failures.
- Produces (client): default export `apiClient` (Axios instance); `submitEnquiry(payload)`; `submitViewing(payload)`. Rejections carry `error.details` (field map) and `error.message`.

- [ ] **Step 1: Create `frontend/src/lib/api/server.js`**

```js
import { toQueryString } from "@/lib/searchParams";

/**
 * Server-side data layer. Used only from Server Components.
 *
 * Uses `fetch` rather than the shared Axios instance because Next's caching is built
 * on `fetch` — Axios bypasses it entirely. In Next 16 fetch is NOT cached by default,
 * so every read here opts in explicitly via `next.revalidate`.
 *
 * The `{ success, data }` envelope is unwrapped in exactly one place: `request()`.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";

/**
 * Perform one API read.
 *
 * @param {string} path      Path under /api, e.g. "/properties".
 * @param {object} options
 * @param {number} options.revalidate  Seconds to cache the response.
 * @param {string[]} options.tags      Cache tags for targeted revalidation later.
 * @param {object}  options.body       Present for POST reads (natural-language search).
 * @returns {Promise<object|null>} The unwrapped `data`, or null on 404.
 */
async function request(path, { revalidate = 60, tags = [], body } = {}) {
  const isPost = body !== undefined;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: isPost ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: isPost ? JSON.stringify(body) : undefined,
    // A POST is never cached — it is a search submission, not a stable resource.
    ...(isPost ? { cache: "no-store" } : { next: { revalidate, tags } }),
  });

  // 404 is a legitimate answer ("no such listing"), not an error condition. The caller
  // turns it into notFound(). Drafts and soft-deleted listings arrive here too, and
  // must be indistinguishable from a slug that never existed.
  if (response.status === 404) return null;

  if (!response.ok) {
    // Surface the API's own message when it sent one; the error boundary renders a
    // friendly page regardless.
    let message = `API request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
    } catch {
      // Non-JSON error body (proxy error, backend down). Keep the status message.
    }
    throw new Error(message);
  }

  const payload = await response.json();
  return payload.data;
}

/** Search listings. `filters` is the object produced by parseSearchParams. */
export function getProperties(filters = {}) {
  const query = toQueryString(filters);
  return request(`/properties${query ? `?${query}` : ""}`, {
    revalidate: 60,
    tags: ["properties"],
  });
}

/** One listing by slug, with gallery and similar listings. Null when not found. */
export function getProperty(slug) {
  return request(`/properties/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    tags: ["properties", `property:${slug}`],
  });
}

/** Homepage featured rail. Backend caps `limit` at 12. */
export function getFeatured(limit = 6) {
  return request(`/properties/featured?limit=${limit}`, {
    revalidate: 300,
    tags: ["properties", "featured"],
  });
}

/** Everything the filter panel needs, including live price bounds. */
export function getFilters() {
  return request("/filters", { revalidate: 3600, tags: ["filters"] });
}

/** Published areas. Pass `{ state, published }` to narrow. */
export function getLocations(params = {}) {
  const query = toQueryString(params);
  return request(`/locations${query ? `?${query}` : ""}`, {
    revalidate: 3600,
    tags: ["locations"],
  });
}

/** One area, with its available listing count. */
export function getLocation(slug) {
  return request(`/locations/${encodeURIComponent(slug)}`, {
    revalidate: 3600,
    tags: ["locations", `location:${slug}`],
  });
}

/**
 * Public site settings. Only used for `listingDisclaimer` in this build — all other
 * chrome is local config (spec §1). Cached hard: it changes rarely.
 */
export function getSettings() {
  return request("/settings", { revalidate: 3600, tags: ["settings"] });
}

/**
 * Natural-language search. Returns the same shape as getProperties plus
 * `interpretation`. Works with AI disabled — the backend's deterministic parser
 * handles prices, "to let", property types and place names on its own.
 */
export function naturalSearch({ q, page = 1, limit = 12, sort = "newest" }) {
  return request("/search", { body: { q, page, limit, sort } });
}
```

- [ ] **Step 2: Create `frontend/src/lib/api/client.js`**

```js
"use client";

import axios from "axios";

/**
 * The single shared Axios instance for browser-side requests (CLAUDE.md: never call
 * bare axios.get at a call site).
 *
 * Scope in this build is deliberately narrow: **writes only** — enquiry submission and
 * viewing requests. All reads happen server-side in lib/api/server.js so pages render
 * on the server for SEO.
 */
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api",
  // Auth is an httpOnly cookie (`re_token`), so credentials must ride along. Set here
  // once rather than per call — the admin panel slice depends on it too.
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/**
 * Normalise every failure into one Error shape so no call site parses the envelope.
 * `details` is the API's field-level validation map, which react-hook-form maps
 * straight onto inputs via setError.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error.response?.data;
    const status = error.response?.status;

    // 429 comes from the strict rate limiter on lead endpoints. A raw error here reads
    // as a broken form; the friendly wording is decided once, here.
    const fallback =
      status === 429
        ? "Too many requests just now — please wait a minute and try again."
        : "Something went wrong. Please try again.";

    const normalised = new Error(payload?.message || fallback);
    normalised.status = status;
    normalised.details = payload?.details ?? null;
    return Promise.reject(normalised);
  },
);

/**
 * Submit a lead. The backend responds before sending email, so this resolves fast even
 * when the mail provider is slow.
 *
 * @param {object} payload - name, phone required; property, type, source,
 *   consentGiven, marketingOptIn optional.
 */
export async function submitEnquiry(payload) {
  const { data } = await apiClient.post("/enquiries", payload);
  return data.data.enquiry;
}

/** Request a viewing. `requestedFor` must be a future ISO datetime. */
export async function submitViewing(payload) {
  const { data } = await apiClient.post("/viewings", payload);
  return data.data.viewing;
}

export default apiClient;
```

- [ ] **Step 3: Verify the backend is reachable and the envelope matches**

Run (backend must be running):

```bash
curl -s http://localhost:5000/api/properties?limit=1 | head -c 300
```

Expected: JSON beginning `{"success":true,"data":{"properties":[`.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api
git commit -m "feat(frontend): server fetch data layer and shared Axios write client"
```

---

## Task 6: UI primitives

**Files:**
- Create: `frontend/src/components/ui/Container.jsx`
- Create: `frontend/src/components/ui/Section.jsx`
- Create: `frontend/src/components/ui/Button.jsx`
- Create: `frontend/src/components/ui/Badge.jsx`
- Create: `frontend/src/components/ui/Skeleton.jsx`

**Interfaces:**
- Consumes: theme tokens from Task 1.
- Produces:
  - `<Container className?>` — `max-w-7xl` + responsive gutters.
  - `<Section eyebrow? title? description? className? children>` — vertical rhythm + heading block.
  - `<Button as? href? variant="primary"|"secondary"|"ghost" size="md"|"lg" loading? disabled? ...props>`.
  - `<Badge tone="success"|"warning"|"danger"|"muted"|"accent">`.
  - `<Skeleton className>` and `<SkeletonCard />`.

- [ ] **Step 1: Create `frontend/src/components/ui/Container.jsx`**

```jsx
/**
 * The one content width used across the whole site. Mixing container widths between
 * sections is the fastest way to make a layout look unconsidered (design system §4).
 */
export default function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/ui/Section.jsx`**

```jsx
import Container from "@/components/ui/Container";

/**
 * A page section with the site's vertical rhythm and an optional heading block.
 * Generous spacing is the style, not an accident — do not tighten it per-section.
 *
 * @param {string} [eyebrow]     Small uppercase label above the title.
 * @param {string} [title]       Section heading (renders as h2).
 * @param {string} [description] Supporting line under the title.
 */
export default function Section({
  eyebrow,
  title,
  description,
  className = "",
  children,
}) {
  return (
    <section className={`py-16 md:py-24 lg:py-32 ${className}`}>
      <Container>
        {/* Heading block is optional — some sections are pure content. */}
        {(eyebrow || title || description) && (
          <div className="mb-10 max-w-2xl md:mb-14">
            {eyebrow && (
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-accent-text">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-3xl text-ink md:text-4xl lg:text-5xl">{title}</h2>
            )}
            {description && (
              <p className="mt-4 max-w-[68ch] text-ink-soft">{description}</p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ui/Button.jsx`**

```jsx
import Link from "next/link";
import { FiLoader } from "react-icons/fi";

/**
 * The site's only button. Renders as a Next <Link> when `href` is passed, otherwise a
 * <button> — so an internal navigation never becomes a raw <a href>.
 *
 * Gold is deliberately not a fill colour with white text: #ca8a04 fails 4.5:1 against
 * white. Primary is white-on-ink; gold stays an accent (design system §2).
 */

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-ink-soft",
  secondary:
    "bg-surface-raised text-ink border border-border hover:border-accent hover:text-accent-text",
  ghost: "text-ink hover:text-accent-text",
};

const SIZES = {
  // min-h-11 = 44px, the minimum touch target.
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-7 text-base",
};

export default function Button({
  href,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded font-medium cursor-pointer",
    // Colour/opacity transitions only — a scale transform would shift neighbours.
    "transition-colors duration-200",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");

  // A link cannot be "loading" or "disabled", so those branches only apply to buttons.
  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {/* Progress lives inside the button so the control never looks frozen. */}
      {loading && <FiLoader className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/ui/Badge.jsx`**

```jsx
/**
 * Small status/label pill. Always renders its text: status is never communicated by
 * colour alone (accessibility floor, design system §5).
 */

const TONES = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  muted: "bg-ink/5 text-ink-soft",
  accent: "bg-accent/10 text-accent-text",
};

export default function Badge({ tone = "muted", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium uppercase tracking-[0.06em] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/ui/Skeleton.jsx`**

```jsx
/**
 * Loading placeholders. Skeletons rather than spinners, sized to match the real
 * content, so nothing reflows when data arrives.
 */
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded bg-ink/5 ${className}`} aria-hidden="true" />;
}

/**
 * A skeleton shaped exactly like PropertyCard: 4/3 image, title, meta row, price.
 * Keep these dimensions in step with PropertyCard or the grid will jump on load.
 */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

export default Skeleton;
```

- [ ] **Step 6: Lint and commit**

Run: `cd frontend && npm run lint`
Expected: silent.

```bash
git add frontend/src/components/ui
git commit -m "feat(frontend): UI primitives — container, section, button, badge, skeleton"
```

---

## Task 7: Header, footer and root layout wiring

**Files:**
- Create: `frontend/src/components/layout/Header.jsx`
- Create: `frontend/src/components/layout/MobileNav.jsx`
- Create: `frontend/src/components/layout/Footer.jsx`
- Modify: `frontend/src/app/layout.js`

**Interfaces:**
- Consumes: `siteConfig` (Task 1), `Container`, `Button` (Task 6).
- Produces: `<Header />` and `<Footer />` mounted in the root layout.

- [ ] **Step 1: Create `frontend/src/components/layout/MobileNav.jsx`**

```jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMenu, FiX } from "react-icons/fi";
import siteConfig from "@/config/site";

/**
 * Mobile navigation drawer. Client component because it holds open/closed state —
 * it is deliberately a leaf so the rest of the header stays server-rendered.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Icon-only control: aria-label is required for screen readers. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
      >
        <FiMenu size={22} aria-hidden="true" />
      </button>

      {/* Drawer renders only when open — nothing to trap focus behind when closed. */}
      {open && (
        <div
          className="fixed inset-0 bg-surface"
          style={{ zIndex: "var(--z-dropdown)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-display text-lg text-ink">{siteConfig.name}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
            >
              <FiX size={22} aria-hidden="true" />
            </button>
          </div>

          {/* Nav items come from config so a rebrand never edits this component. */}
          <nav className="flex flex-col px-4 pt-6">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-4 font-display text-2xl text-ink transition-colors duration-200 hover:text-accent-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/layout/Header.jsx`**

```jsx
import Link from "next/link";
import { FiPhone } from "react-icons/fi";
import Container from "@/components/ui/Container";
import MobileNav from "@/components/layout/MobileNav";
import siteConfig from "@/config/site";

/**
 * Site header. A Server Component — only the mobile drawer needs client state.
 *
 * The wordmark is rendered from siteConfig.name rather than an image, so a copied repo
 * is renamed without producing a logo file (scope §9).
 */
export default function Header() {
  return (
    <header
      className="sticky top-0 border-b border-border bg-surface/90 backdrop-blur"
      style={{ zIndex: "var(--z-header)" }}
    >
      <Container className="flex h-16 items-center justify-between md:h-20">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-ink transition-colors duration-200 hover:text-accent-text md:text-2xl"
        >
          {siteConfig.name}
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
            >
              {item.label}
            </Link>
          ))}
          {/* Phone is the primary conversion channel in this market, so it sits in
              the header rather than only in the footer. */}
          <a
            href={`tel:${siteConfig.phone}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink transition-colors duration-200 hover:text-accent-text"
          >
            <FiPhone size={16} aria-hidden="true" />
            {siteConfig.phone}
          </a>
        </nav>

        <MobileNav />
      </Container>
    </header>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/layout/Footer.jsx`**

```jsx
import Link from "next/link";
import { FiInstagram, FiFacebook, FiTwitter, FiLinkedin } from "react-icons/fi";
import Container from "@/components/ui/Container";
import siteConfig from "@/config/site";

// Social platform key -> icon. Only platforms with a configured URL are rendered.
const SOCIAL_ICONS = {
  instagram: FiInstagram,
  facebook: FiFacebook,
  twitter: FiTwitter,
  linkedin: FiLinkedin,
};

/**
 * Site footer. All content comes from siteConfig — no address, phone number or
 * agency name is written into this file.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink text-white/70">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Brand + tagline */}
          <div>
            <p className="font-display text-2xl text-white">{siteConfig.name}</p>
            <p className="mt-3 max-w-[40ch] text-sm">{siteConfig.tagline}</p>
          </div>

          {/* Navigation mirror */}
          <nav className="flex flex-col gap-3 text-sm">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors duration-200 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Contact block */}
          <div className="space-y-3 text-sm">
            <a
              href={`tel:${siteConfig.phone}`}
              className="block transition-colors duration-200 hover:text-white"
            >
              {siteConfig.phone}
            </a>
            <a
              href={`mailto:${siteConfig.email}`}
              className="block transition-colors duration-200 hover:text-white"
            >
              {siteConfig.email}
            </a>
            <p className="max-w-[36ch]">{siteConfig.address}</p>
            {/* Office hours render as a list; an empty array simply renders nothing. */}
            {siteConfig.officeHours.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs">
            © {year} {siteConfig.legalName}. All rights reserved.
          </p>

          {/* Social icons — only those with a URL configured. */}
          <div className="flex gap-4">
            {Object.entries(siteConfig.socials).map(([key, url]) => {
              const Icon = SOCIAL_ICONS[key];
              if (!url || !Icon) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={key}
                  className="flex h-11 w-11 items-center justify-center transition-colors duration-200 hover:text-white"
                >
                  <Icon size={18} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 4: Mount them in `frontend/src/app/layout.js`**

Replace the body contents from Task 1, Step 4:

```jsx
      <body className="min-h-full flex flex-col">
        <Header />
        {/* Grows to push the footer down on short pages. */}
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster position="bottom-center" />
      </body>
```

Add the imports at the top of the file:

```js
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
```

- [ ] **Step 5: Verify visually**

Run: `cd frontend && npm run dev`, open `http://localhost:3000`.
Expected: header with wordmark and nav, footer with contact block. Resize to 375px — the mobile menu button appears, the drawer opens and closes, and there is no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout frontend/src/app/layout.js
git commit -m "feat(frontend): site header, mobile nav and footer"
```

---

## Task 8: PropertyCard and PropertyGrid

**Files:**
- Create: `frontend/src/components/property/PropertyCard.jsx`
- Create: `frontend/src/components/property/PropertyGrid.jsx`
- Test: `frontend/src/components/property/PropertyCard.test.jsx`

**Interfaces:**
- Consumes: `priceOf`, `coverImageOf`, `statusLabel`, `propertyPath` (Task 3); `formatArea`, `humanise` (Task 2); `Badge` (Task 6).
- Produces: `<PropertyCard property priority? />` and `<PropertyGrid properties />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/property/PropertyCard.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PropertyCard from "./PropertyCard";

// next/image and next/link need stubbing: Vitest does not run the Next compiler.
vi.mock("next/image", () => ({
  default: ({ alt, src, fill, priority, sizes, ...rest }) => (
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/property/PropertyCard.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `frontend/src/components/property/PropertyCard.jsx`**

```jsx
import Image from "next/image";
import Link from "next/link";
import { FiMapPin } from "react-icons/fi";
import Badge from "@/components/ui/Badge";
import { priceOf, coverImageOf, statusLabel, propertyPath } from "@/lib/property";
import { formatArea, humanise } from "@/lib/format";

/**
 * The single listing representation, used by the featured rail, the results grid and
 * the "similar listings" strip. Takes the API card object verbatim and never fetches.
 *
 * @param {object} property  A property card object from the API.
 * @param {boolean} priority Set on above-the-fold cards so next/image preloads them.
 */
export default function PropertyCard({ property, priority = false }) {
  const price = priceOf(property);
  const cover = coverImageOf(property);
  const status = statusLabel(property.status);
  const area = formatArea(property.landSizeSqm);

  // Land and commercial stock has no bedroom count; rendering "0 bed" looks broken.
  const showRooms = property.bedrooms > 0;

  return (
    <Link
      href={propertyPath(property)}
      className="group block overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors duration-200 hover:border-accent"
    >
      {/* Image region — fixed 4/3 ratio reserves space so the grid never reflows. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink/5">
        <Image
          src={cover.url}
          alt={cover.alt}
          fill
          // Tells the browser the real rendered width per breakpoint, so it does not
          // download a 1200px file for a 380px card.
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="object-cover"
        />
        {/* Status sits on the image; the label always renders, never colour alone. */}
        <div className="absolute left-3 top-3">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      {/* Content region */}
      <div className="p-5">
        <p className="mb-2 text-xs uppercase tracking-[0.08em] text-muted">
          {humanise(property.propertyType)} · {property.listingType === "rent" ? "To let" : "For sale"}
        </p>

        <h3 className="line-clamp-2 text-lg text-ink transition-colors duration-200 group-hover:text-accent-text">
          {property.title}
        </h3>

        {/* Area line */}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
          <FiMapPin size={14} aria-hidden="true" />
          {property.location?.name}
          {property.location?.state ? `, ${property.location.state}` : ""}
        </p>

        {/* Spec row. Bathrooms and toilets are separate counts and both are shown. */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft tabular">
          {showRooms && <span>{property.bedrooms} bed</span>}
          {showRooms && <span>{property.bathrooms} bath</span>}
          {showRooms && (
            <span>
              {property.toilets} toilet{property.toilets === 1 ? "" : "s"}
            </span>
          )}
          {area && <span>{area}</span>}
        </div>

        {/* Price block */}
        <div className="mt-5 flex items-baseline gap-2 border-t border-border pt-4">
          <span className="font-display text-xl text-ink tabular">{price.label}</span>
          {/* Rent period is always stated — omitting it reads as a monthly figure. */}
          {price.suffix && <span className="text-sm text-muted">{price.suffix}</span>}
          {price.isNegotiable && (
            <Badge tone="accent" className="ml-auto">
              Negotiable
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/property/PropertyCard.test.jsx`
Expected: PASS.

- [ ] **Step 5: Write `frontend/src/components/property/PropertyGrid.jsx`**

```jsx
import PropertyCard from "@/components/property/PropertyCard";

/**
 * Responsive listing grid: 1 column on mobile, 2 from sm, 3 from lg.
 *
 * The first three cards are marked `priority` because on a desktop results page they
 * are the above-the-fold row; everything after them lazy-loads.
 */
export default function PropertyGrid({ properties = [] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property, index) => (
        <PropertyCard key={property._id} property={property} priority={index < 3} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/property
git commit -m "feat(frontend): property card and grid"
```

---

## Task 9: Search results page — server route and result chrome

**Files:**
- Create: `frontend/src/app/properties/page.js`
- Create: `frontend/src/app/properties/loading.js`
- Create: `frontend/src/components/search/FilterChips.jsx`
- Create: `frontend/src/components/search/RelaxationNotice.jsx`
- Create: `frontend/src/components/search/EmptyResults.jsx`
- Create: `frontend/src/components/search/Pagination.jsx`
- Create: `frontend/src/components/search/SortSelect.jsx`

**Interfaces:**
- Consumes: `parseSearchParams`, `toQueryString`, `withFilter` (Task 4); `getProperties`, `naturalSearch` (Task 5); `PropertyGrid` (Task 8).
- Produces: the `/properties` route. `FilterChips` takes `{ applied, filters }`; `Pagination` takes `{ pagination, filters }`; `SortSelect` takes `{ filters }`; `RelaxationNotice` takes `{ relaxed, unmatched }`.

- [ ] **Step 1: Create `frontend/src/components/search/FilterChips.jsx`**

```jsx
import Link from "next/link";
import { FiX } from "react-icons/fi";
import { toQueryString, withFilter } from "@/lib/searchParams";
import { humanise, formatMoney } from "@/lib/format";

/**
 * Removable chips showing how the visitor's request was interpreted (scope §5.2 step 7).
 *
 * IMPORTANT: these render `applied` — what was ASKED FOR — never the relaxed search.
 * If the backend widened the search to find results, that is reported separately by
 * RelaxationNotice. Rewriting the chips to match a relaxed query would tell the visitor
 * they searched for something they did not.
 */

/**
 * Flatten the API's `applied` object into a list of removable chips.
 * Each chip knows which filter key it clears, so removal is a plain link.
 */
function buildChips(applied = {}) {
  const chips = [];

  if (applied.listingType) {
    chips.push({
      key: "listingType",
      label: applied.listingType === "rent" ? "To let" : "For sale",
    });
  }

  // propertyType comes back as an array even for a single selection.
  for (const type of applied.propertyType ?? []) {
    chips.push({ key: "propertyType", label: humanise(type) });
  }

  for (const location of applied.locations ?? []) {
    chips.push({ key: "location", label: location.name });
  }

  for (const amenity of applied.amenities ?? []) {
    chips.push({ key: "amenities", label: amenity.name });
  }

  if (applied.bedroomsMin) {
    chips.push({ key: "bedroomsMin", label: `${applied.bedroomsMin}+ bed` });
  }

  if (applied.priceMax) {
    chips.push({ key: "priceMax", label: `Under ${formatMoney(applied.priceMax, "NGN")}` });
  }

  if (applied.priceMin) {
    chips.push({ key: "priceMin", label: `Over ${formatMoney(applied.priceMin, "NGN")}` });
  }

  if (applied.titleType) {
    chips.push({ key: "titleType", label: humanise(applied.titleType) });
  }

  return chips;
}

export default function FilterChips({ applied, filters }) {
  const chips = buildChips(applied);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        // Removing a chip is a navigation, not client state — keeps the URL canonical.
        const next = toQueryString(withFilter(filters, chip.key, null));
        return (
          <Link
            key={`${chip.key}-${chip.label}`}
            href={`/properties${next ? `?${next}` : ""}`}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink-soft transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            {chip.label}
            <FiX size={14} aria-hidden="true" />
            <span className="sr-only">Remove filter</span>
          </Link>
        );
      })}

      {/* Escape hatch back to an unfiltered search. */}
      <Link
        href="/properties"
        className="min-h-9 cursor-pointer px-2 py-1.5 text-sm text-muted underline underline-offset-4 transition-colors duration-200 hover:text-ink"
      >
        Clear all
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/search/RelaxationNotice.jsx`**

```jsx
import { FiInfo } from "react-icons/fi";

/**
 * Tells the visitor when the backend widened their search to find results (scope §5.5).
 *
 * Without this, a Lekki searcher shown listings from a neighbouring area reads the page
 * as broken. The rungs come back in order from the API.
 */

// Rung key -> the sentence shown to the visitor.
const RUNG_COPY = {
  price_band: "we widened the price range",
  nearby_areas: "we included nearby areas in the same state",
  bedrooms: "we relaxed the bedroom count",
};

export default function RelaxationNotice({ relaxed = [], unmatched = [] }) {
  // Nothing was widened and everything was understood — say nothing.
  if (relaxed.length === 0 && unmatched.length === 0) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-ink-soft">
      <FiInfo size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
      <div className="space-y-1">
        {relaxed.length > 0 && (
          <p>
            No exact matches, so{" "}
            {relaxed.map((rung) => RUNG_COPY[rung] ?? rung).join(", and ")}.
          </p>
        )}
        {/* Terms the site does not cover are surfaced, not silently dropped. */}
        {unmatched.length > 0 && (
          <p>
            We don&apos;t cover {unmatched.join(", ")} yet — those parts of your search
            were ignored.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/search/EmptyResults.jsx`**

```jsx
import { FiSearch } from "react-icons/fi";
import Button from "@/components/ui/Button";

/**
 * Shown when a search returns nothing even after the backend's relaxation ladder.
 * Always offers a route onward — a bare "no results" page ends the visit.
 */
export default function EmptyResults() {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-6 py-16 text-center">
      <FiSearch size={32} className="mx-auto text-muted" aria-hidden="true" />
      <h2 className="mt-5 text-2xl text-ink">Nothing matched that search</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
        Try removing a filter, widening the price range, or searching a broader area.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/properties">Browse all listings</Button>
        <Button href="/properties?listingType=rent" variant="secondary">
          See rentals
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/search/Pagination.jsx`**

```jsx
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { toQueryString } from "@/lib/searchParams";

/**
 * Page navigation for the results grid. Links rather than buttons, so each page has a
 * real crawlable URL and the back button behaves.
 *
 * @param {{page:number, pages:number, total:number}} pagination From the API.
 * @param {object} filters Current filter object, so page links preserve the search.
 */
export default function Pagination({ pagination, filters }) {
  const { page, pages } = pagination;
  // One page of results needs no control at all.
  if (pages <= 1) return null;

  const hrefFor = (target) => {
    const query = toQueryString({ ...filters, page: target });
    return `/properties${query ? `?${query}` : ""}`;
  };

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
      {/* Previous — rendered as inert text on page 1 rather than a dead link. */}
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink transition-colors duration-200 hover:text-accent-text"
        >
          <FiChevronLeft size={16} aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-muted">
          <FiChevronLeft size={16} aria-hidden="true" />
          Previous
        </span>
      )}

      <p className="text-sm text-ink-soft tabular">
        Page {page} of {pages}
      </p>

      {page < pages ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink transition-colors duration-200 hover:text-accent-text"
        >
          Next
          <FiChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-muted">
          Next
          <FiChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/search/SortSelect.jsx`**

```jsx
"use client";

import { useRouter } from "next/navigation";
import { toQueryString, withFilter } from "@/lib/searchParams";

/**
 * Sort control. A client component only because a <select> change must navigate;
 * the state itself still lives in the URL, not in React.
 */

// Values match what GET /api/properties accepts for `sort`.
const OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export default function SortSelect({ filters }) {
  const router = useRouter();

  const onChange = (event) => {
    // withFilter clears `page` too — page 3 of the old ordering is meaningless.
    const query = toQueryString(withFilter(filters, "sort", event.target.value));
    router.push(`/properties${query ? `?${query}` : ""}`);
  };

  return (
    <div className="flex items-center gap-2">
      {/* A real label, not a placeholder masquerading as one. */}
      <label htmlFor="sort" className="text-sm text-muted">
        Sort
      </label>
      <select
        id="sort"
        value={filters.sort ?? "newest"}
        onChange={onChange}
        className="min-h-11 cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink transition-colors duration-200 hover:border-accent"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/app/properties/loading.js`**

```jsx
import Container from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Streamed fallback for the results route. Card skeletons match PropertyCard's
 * dimensions so the grid does not jump when the real data arrives.
 */
export default function Loading() {
  return (
    <Container className="py-10">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-4 h-5 w-40" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </Container>
  );
}
```

- [ ] **Step 7: Create `frontend/src/app/properties/page.js`**

```jsx
import Container from "@/components/ui/Container";
import PropertyGrid from "@/components/property/PropertyGrid";
import FilterPanel from "@/components/search/FilterPanel";
import FilterChips from "@/components/search/FilterChips";
import RelaxationNotice from "@/components/search/RelaxationNotice";
import EmptyResults from "@/components/search/EmptyResults";
import Pagination from "@/components/search/Pagination";
import SortSelect from "@/components/search/SortSelect";
import SearchBar from "@/components/search/SearchBar";
import { getProperties, getFilters, naturalSearch } from "@/lib/api/server";
import { parseSearchParams } from "@/lib/searchParams";

// Search results must be server-rendered: organic search is the primary acquisition
// channel (scope §4.4), so the grid has to exist in the initial HTML.
export const metadata = {
  title: "Property search",
  description:
    "Search available homes, land and commercial property. Filter by area, type, price and bedrooms.",
};

/**
 * Property search results.
 *
 * All state lives in the URL. This component reads it, fetches on the server, and
 * renders. The filter panel never fetches — it pushes a new URL and this runs again.
 *
 * Next 16: `searchParams` is a Promise and must be awaited.
 */
export default async function PropertiesPage({ searchParams }) {
  const raw = await searchParams;
  const filters = parseSearchParams(raw);

  // Two entry points, one renderer: a free-text query goes through the natural-language
  // endpoint (which works with AI disabled), everything else through the filter query.
  // Both return the same envelope, so nothing downstream branches.
  const [results, filterOptions] = await Promise.all([
    filters.q
      ? naturalSearch({
          q: filters.q,
          page: filters.page ?? 1,
          limit: filters.limit ?? 12,
          sort: filters.sort ?? "newest",
        })
      : getProperties(filters),
    getFilters(),
  ]);

  const properties = results?.properties ?? [];
  const pagination = results?.pagination ?? { page: 1, pages: 1, total: 0 };

  return (
    <Container className="py-10 md:py-14">
      {/* Page heading + free-text search, so a visitor can restate their query here. */}
      <div className="max-w-3xl">
        <h1 className="text-3xl text-ink md:text-4xl">
          {filters.q ? `Results for “${filters.q}”` : "Property search"}
        </h1>
        <p className="mt-3 text-ink-soft tabular">
          {pagination.total} {pagination.total === 1 ? "listing" : "listings"}
        </p>
      </div>

      <div className="mt-8">
        <SearchBar defaultValue={filters.q ?? ""} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[18rem_1fr]">
        {/* Filter rail — a client component that only builds URLs. */}
        <aside>
          <FilterPanel options={filterOptions} filters={filters} />
        </aside>

        <div className="min-w-0 space-y-6">
          {/* Chips reflect what was asked for, never the relaxed search. */}
          <FilterChips applied={results?.applied ?? {}} filters={filters} />

          {/* Widened searches and unrecognised terms are always disclosed. */}
          <RelaxationNotice
            relaxed={results?.relaxed ?? []}
            unmatched={results?.unmatched ?? []}
          />

          <div className="flex items-center justify-end">
            <SortSelect filters={filters} />
          </div>

          {/* Results, or a route onward when there are none. */}
          {properties.length > 0 ? (
            <>
              <PropertyGrid properties={properties} />
              <div className="pt-6">
                <Pagination pagination={pagination} filters={filters} />
              </div>
            </>
          ) : (
            <EmptyResults />
          )}
        </div>
      </div>
    </Container>
  );
}
```

> This page imports `FilterPanel` and `SearchBar`, built in Tasks 10 and 11. Build those two first if you are executing out of order, or the route will not compile.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/properties frontend/src/components/search
git commit -m "feat(frontend): search results route with chips, relaxation notice and pagination"
```

---

## Task 10: Filter panel

**Files:**
- Create: `frontend/src/components/search/FilterPanel.jsx`

**Interfaces:**
- Consumes: `GET /api/filters` payload (`listingTypes`, `propertyTypes`, `titleTypes`, `locations`, `taxonomy`, `priceRange`), `withFilter`, `toQueryString`, `humanise`.
- Produces: `<FilterPanel options filters />`.

- [ ] **Step 1: Create the component**

```jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiFilter, FiX } from "react-icons/fi";
import Button from "@/components/ui/Button";
import { toQueryString, withFilter } from "@/lib/searchParams";
import { humanise, formatMoney } from "@/lib/format";

/**
 * The filter rail. A client component because it handles input, but it holds no result
 * state and never fetches: every change builds a new URL and navigates, which re-runs
 * the server component that owns the data (spec §2.4).
 *
 * @param {object} options Payload from GET /api/filters — locations, types, taxonomy
 *   and the real price bounds computed from live stock.
 * @param {object} filters Current filter object parsed from the URL.
 */
export default function FilterPanel({ options, filters }) {
  const router = useRouter();
  // Mobile shows the rail as a sheet; desktop shows it inline.
  const [open, setOpen] = useState(false);

  /** Apply one filter change by navigating to the new URL. */
  const apply = (key, value) => {
    const query = toQueryString(withFilter(filters, key, value));
    router.push(`/properties${query ? `?${query}` : ""}`);
  };

  /** Toggle one amenity in or out of the multi-select array. */
  const toggleAmenity = (key) => {
    const current = filters.amenities ?? [];
    const next = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
    apply("amenities", next);
  };

  // Sale and rent prices differ by orders of magnitude, so the bound shown depends on
  // which listing type is selected — one shared slider would be useless for both.
  const priceBounds =
    filters.listingType === "rent" ? options?.priceRange?.rent : options?.priceRange?.sale;

  // Amenities are the "amenity" slice of the taxonomy; other categories are not
  // filterable in this slice.
  const amenities = (options?.taxonomy ?? []).filter((term) => term.category === "amenity");

  const panel = (
    <div className="space-y-8">
      {/* Listing type */}
      <fieldset>
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Listing type
        </legend>
        <div className="flex gap-2">
          {(options?.listingTypes ?? []).map((type) => {
            const active = filters.listingType === type;
            return (
              <button
                key={type}
                type="button"
                // Clicking the active option clears it — no separate "any" control.
                onClick={() => apply("listingType", active ? null : type)}
                aria-pressed={active}
                className={`min-h-11 flex-1 cursor-pointer rounded border px-3 text-sm transition-colors duration-200 ${
                  active
                    ? "border-accent bg-accent/10 text-accent-text"
                    : "border-border bg-surface-raised text-ink-soft hover:border-accent"
                }`}
              >
                {type === "rent" ? "To let" : "For sale"}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Property type */}
      <div>
        <label
          htmlFor="propertyType"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Property type
        </label>
        <select
          id="propertyType"
          value={filters.propertyType ?? ""}
          onChange={(event) => apply("propertyType", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Any type</option>
          {(options?.propertyTypes ?? []).map((type) => (
            // The API sends machine keys deliberately; labels are ours to decide.
            <option key={type} value={type}>
              {humanise(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label
          htmlFor="location"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Area
        </label>
        <select
          id="location"
          value={filters.location ?? ""}
          onChange={(event) => apply("location", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Anywhere</option>
          {(options?.locations ?? []).map((location) => (
            // Slug carries a state suffix because area names repeat across states.
            <option key={location._id} value={location.slug}>
              {location.name}, {location.state}
            </option>
          ))}
        </select>
      </div>

      {/* Bedrooms — a minimum, which is how people actually search. */}
      <div>
        <label
          htmlFor="bedroomsMin"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Bedrooms (minimum)
        </label>
        <select
          id="bedroomsMin"
          value={filters.bedroomsMin ?? ""}
          onChange={(event) => apply("bedroomsMin", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5, 6].map((count) => (
            <option key={count} value={count}>
              {count}+
            </option>
          ))}
        </select>
      </div>

      {/* Max price. Bounds come from live stock, so the ceiling is always reachable. */}
      {priceBounds && (
        <div>
          <label
            htmlFor="priceMax"
            className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
          >
            Maximum price
          </label>
          <select
            id="priceMax"
            value={filters.priceMax ?? ""}
            onChange={(event) => apply("priceMax", event.target.value || null)}
            className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
          >
            <option value="">No maximum</option>
            {/* Five evenly spaced steps across the real range beats an arbitrary list. */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((fraction) => {
              const value = Math.round(priceBounds.max * fraction);
              return (
                <option key={fraction} value={value}>
                  Under {formatMoney(value, "NGN")}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Land title — a Nigerian-market filter with real weight for buyers. */}
      <div>
        <label
          htmlFor="titleType"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Land title
        </label>
        <select
          id="titleType"
          value={filters.titleType ?? ""}
          onChange={(event) => apply("titleType", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Any title</option>
          {(options?.titleTypes ?? []).map((type) => (
            <option key={type} value={type}>
              {humanise(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Amenities — multi-select, each rendered as a real checkbox with a label. */}
      {amenities.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">
            Amenities
          </legend>
          <div className="space-y-1">
            {amenities.map((term) => (
              <label
                key={term._id}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft"
              >
                <input
                  type="checkbox"
                  checked={(filters.amenities ?? []).includes(term.key)}
                  onChange={() => toggleAmenity(term.key)}
                  className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                />
                {term.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <FiFilter size={16} aria-hidden="true" />
          Filters
        </Button>
      </div>

      {/* Mobile sheet — full screen so the long list of controls is usable. */}
      {open && (
        <div
          className="fixed inset-0 overflow-y-auto bg-surface p-4 lg:hidden"
          style={{ zIndex: "var(--z-dropdown)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl text-ink">Filters</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
            >
              <FiX size={22} aria-hidden="true" />
            </button>
          </div>
          {panel}
          <div className="sticky bottom-0 mt-8 bg-surface py-4">
            <Button onClick={() => setOpen(false)} className="w-full">
              Show results
            </Button>
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <div className="hidden lg:block">{panel}</div>
    </>
  );
}
```

- [ ] **Step 2: Verify against the running app**

Run: backend on 5000, then `cd frontend && npm run dev`. Open `http://localhost:3000/properties`.
Expected: the rail renders populated from live data; selecting "To let" changes the URL to `?listingType=rent` and the grid updates; the browser back button restores the previous result set.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/search/FilterPanel.jsx
git commit -m "feat(frontend): filter panel driven by /api/filters"
```

---

## Task 11: Natural-language search bar and homepage

**Files:**
- Create: `frontend/src/components/search/SearchBar.jsx`
- Create: `frontend/src/content/home.js`
- Modify: `frontend/src/app/page.js` (full rewrite)

**Interfaces:**
- Consumes: `getFeatured`, `getLocations` (Task 5); `PropertyGrid` (Task 8); `Section`, `Container`, `Button` (Task 6).
- Produces: `<SearchBar defaultValue? />`; the `/` route; `homeContent` default export from `@/content/home`.

- [ ] **Step 1: Create `frontend/src/components/search/SearchBar.jsx`**

```jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch } from "react-icons/fi";

/**
 * Free-text property search — the site's primary call to action.
 *
 * Submitting navigates to /properties?q=... and the server component there calls
 * POST /api/search. This works with AI switched off (the default): the backend's
 * deterministic parser handles prices, "to let", property types and place names, so
 * there is no client-side branch on whether AI is enabled.
 */
export default function SearchBar({ defaultValue = "" }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const onSubmit = (event) => {
    event.preventDefault();
    const query = value.trim();
    // An empty submit browses everything rather than erroring.
    router.push(query ? `/properties?q=${encodeURIComponent(query)}` : "/properties");
  };

  return (
    <form onSubmit={onSubmit} className="w-full">
      {/* Visually hidden label — the placeholder is a hint, not a label. */}
      <label htmlFor="property-search" className="sr-only">
        Search properties
      </label>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 px-2">
          <FiSearch size={20} className="shrink-0 text-muted" aria-hidden="true" />
          <input
            id="property-search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            // The API rejects a phrase over 500 characters; stop it at the input.
            maxLength={500}
            placeholder="3 bedroom flat in Lekki under 100m"
            className="min-h-11 w-full bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="min-h-12 cursor-pointer rounded bg-ink px-7 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          Search
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `frontend/src/content/home.js`**

```js
/**
 * Homepage copy. Local to the repo rather than fetched from the database (spec §1):
 * this build does not need non-technical staff editing, and keeping copy in one module
 * still makes the copy-and-rebrand step a single-file edit (scope §9).
 *
 * No component below should contain a marketing sentence — it belongs here.
 */
const homeContent = {
  hero: {
    heading: "Find the address you actually want.",
    subheading:
      "Search verified homes, land and commercial property across Nigeria — or tell us what you're looking for in plain English.",
  },

  featured: {
    eyebrow: "Handpicked",
    title: "Featured listings",
    description: "A selection of what's currently available through our team.",
  },

  areas: {
    eyebrow: "Where we work",
    title: "Browse by area",
    description: "The neighbourhoods our team knows best.",
  },

  trust: {
    eyebrow: "Why work with us",
    title: "Property handled properly",
    points: [
      {
        title: "Title verified before listing",
        body: "Every listing states its land title — C of O, Governor's Consent, excision or gazette — so you know what you're buying into before you view.",
      },
      {
        title: "One agent, start to finish",
        body: "The consultant who shows you the property is the one who takes it through to completion. No handoffs, no repeating yourself.",
      },
      {
        title: "Honest pricing",
        body: "Rent is quoted per annum with the advance clearly stated, and agency fees follow the statutory limits in each state.",
      },
    ],
  },

  cta: {
    title: "Have a property to sell or let?",
    body: "We handle valuation, photography, listing and viewings. Tell us about the property and we'll come back to you.",
    action: "Talk to our team",
  },
};

export default homeContent;
```

- [ ] **Step 3: Rewrite `frontend/src/app/page.js`**

```jsx
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/search/SearchBar";
import PropertyGrid from "@/components/property/PropertyGrid";
import { getFeatured, getLocations } from "@/lib/api/server";
import homeContent from "@/content/home";
import siteConfig from "@/config/site";

/**
 * Homepage.
 *
 * Search is the hero, not a slogan over a stock photo: reducing friction to the first
 * search is the whole conversion path for a lead-generation site (design system §1).
 * Server-rendered so the featured listings are in the initial HTML for crawlers.
 */
export default async function HomePage() {
  // Both reads are independent — fetch them together rather than in series.
  const [featured, locations] = await Promise.all([
    getFeatured(6),
    getLocations({ published: true }),
  ]);

  const properties = featured?.properties ?? [];
  // Show a manageable strip of areas; the full list lives on the search page filter.
  const areas = (locations?.locations ?? []).slice(0, 8);

  return (
    <>
      {/* Hero — oversized display type, then the search bar as the primary CTA. */}
      <Container className="py-20 md:py-28 lg:py-36">
        <div className="max-w-4xl">
          <h1 className="text-[clamp(2.75rem,7vw,5.5rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            {homeContent.hero.heading}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg text-ink-soft">
            {homeContent.hero.subheading}
          </p>
        </div>

        <div className="mt-10 max-w-3xl">
          <SearchBar />
        </div>

        {/* Quick entry points beneath the search field. */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/properties?listingType=sale" variant="secondary">
            Homes for sale
          </Button>
          <Button href="/properties?listingType=rent" variant="secondary">
            Homes to let
          </Button>
          <Button href="/properties?propertyType=land" variant="secondary">
            Land
          </Button>
        </div>
      </Container>

      {/* Featured listings. Section is omitted entirely when nothing is featured —
          an empty rail looks like a fault. */}
      {properties.length > 0 && (
        <Section
          eyebrow={homeContent.featured.eyebrow}
          title={homeContent.featured.title}
          description={homeContent.featured.description}
          className="bg-surface-raised"
        >
          <PropertyGrid properties={properties} />
          <div className="mt-12">
            <Button href="/properties">
              See all listings
              <FiArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </Section>
      )}

      {/* Browse by area — each tile is a pre-filtered search, not a separate page,
          because area landing pages are a later slice. */}
      {areas.length > 0 && (
        <Section
          eyebrow={homeContent.areas.eyebrow}
          title={homeContent.areas.title}
          description={homeContent.areas.description}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((area) => (
              <Link
                key={area._id}
                href={`/properties?location=${area.slug}`}
                className="group flex min-h-16 items-center justify-between rounded-lg border border-border bg-surface-raised px-5 py-4 transition-colors duration-200 hover:border-accent"
              >
                <span className="text-ink transition-colors duration-200 group-hover:text-accent-text">
                  {area.name}
                </span>
                <FiArrowRight
                  size={16}
                  className="text-muted transition-colors duration-200 group-hover:text-accent-text"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Trust points */}
      <Section
        eyebrow={homeContent.trust.eyebrow}
        title={homeContent.trust.title}
        className="bg-surface-raised"
      >
        <div className="grid gap-10 md:grid-cols-3">
          {homeContent.trust.points.map((point) => (
            <div key={point.title}>
              {/* Gold hairline as the accent — gold text at this size would fail AA. */}
              <div className="mb-5 h-px w-12 bg-accent" />
              <h3 className="text-xl text-ink">{point.title}</h3>
              <p className="mt-3 max-w-[42ch] text-ink-soft">{point.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Seller/landlord CTA — the §3 "list your property" pipeline. Until that page
          exists this dials the office, which is still a lead. */}
      <Section>
        <div className="rounded-lg bg-ink px-8 py-14 text-center md:px-16 md:py-20">
          <h2 className="mx-auto max-w-[24ch] text-3xl text-white md:text-4xl">
            {homeContent.cta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[56ch] text-white/70">{homeContent.cta.body}</p>
          <a
            href={`tel:${siteConfig.phone}`}
            className="mt-8 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded bg-white px-7 text-sm font-medium text-ink transition-colors duration-200 hover:bg-white/90"
          >
            {homeContent.cta.action}
            <FiArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Section>
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run dev`, open `http://localhost:3000`.
Expected: hero with search, featured grid populated from `realestate_dev`, area tiles. Typing "3 bedroom flat in Lekki under 100m" and submitting lands on `/properties?q=...` with chips reflecting the parsed filters.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/search/SearchBar.jsx frontend/src/content/home.js frontend/src/app/page.js
git commit -m "feat(frontend): homepage with natural-language search entry"
```

---

## Task 12: Property detail page

**Files:**
- Create: `frontend/src/app/property/[slug]/page.js`
- Create: `frontend/src/components/property/PropertyGallery.jsx`
- Create: `frontend/src/components/property/KeyFacts.jsx`
- Create: `frontend/src/components/property/AgentCard.jsx`

**Interfaces:**
- Consumes: `getProperty`, `getSettings` (Task 5); `priceOf`, `statusLabel`, `coverImageOf` (Task 3); `formatArea`, `humanise`, `formatRentPeriod` (Task 2).
- Produces: the `/property/[slug]` route. `<PropertyGallery images title />`, `<KeyFacts property />`, `<AgentCard agent property />`.

- [ ] **Step 1: Create `frontend/src/components/property/PropertyGallery.jsx`**

```jsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

/**
 * Listing gallery with a lightbox.
 *
 * "No way to explore the property beyond one image" is a named anti-pattern for this
 * product type — a real gallery is a requirement, not a nicety.
 *
 * @param {Array<{_id:string,url:string,alt:string}>} images Ordered by displayOrder.
 * @param {string} title Used as fallback alt text.
 */
export default function PropertyGallery({ images = [], title }) {
  // null = lightbox closed; a number = the index being viewed.
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // A listing with no media still needs a hero area, handled by the caller.
  if (images.length === 0) return null;

  const [hero, ...rest] = images;
  const thumbs = rest.slice(0, 4);

  const move = (delta) => {
    setLightboxIndex((current) => (current + delta + images.length) % images.length);
  };

  return (
    <>
      {/* Hero image plus a thumbnail column on wide screens. */}
      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="relative aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-lg bg-ink/5"
          aria-label="Open gallery"
        >
          <Image
            src={hero.url}
            alt={hero.alt || title}
            fill
            sizes="(min-width: 768px) 66vw, 100vw"
            // The hero is the page's largest contentful paint — load it eagerly.
            priority
            className="object-cover"
          />
        </button>

        {thumbs.length > 0 && (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-1">
            {thumbs.map((image, index) => (
              <button
                key={image._id}
                type="button"
                onClick={() => setLightboxIndex(index + 1)}
                className="relative aspect-[3/2] cursor-pointer overflow-hidden rounded bg-ink/5"
                aria-label={`Open image ${index + 2}`}
              >
                <Image
                  src={image.url}
                  alt={image.alt || title}
                  fill
                  sizes="(min-width: 768px) 20vw, 25vw"
                  className="object-cover"
                />
                {/* The last thumbnail shows the remaining count rather than hiding it. */}
                {index === thumbs.length - 1 && images.length > 5 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-medium text-white">
                    +{images.length - 5}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-ink/95 p-4"
          style={{ zIndex: "var(--z-lightbox)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Property images"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close gallery"
            className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center text-white"
          >
            <FiX size={24} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous image"
            className="absolute left-4 flex h-11 w-11 cursor-pointer items-center justify-center text-white"
          >
            <FiChevronLeft size={28} aria-hidden="true" />
          </button>

          <div className="relative h-[80vh] w-full max-w-5xl">
            <Image
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].alt || title}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next image"
            className="absolute right-4 flex h-11 w-11 cursor-pointer items-center justify-center text-white"
          >
            <FiChevronRight size={28} aria-hidden="true" />
          </button>

          <p className="absolute bottom-6 text-sm text-white/70 tabular">
            {lightboxIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/property/KeyFacts.jsx`**

```jsx
import { formatArea, humanise, formatRentPeriod } from "@/lib/format";

/**
 * The specification table for a listing.
 *
 * Rows are built conditionally and empty ones are dropped, so land (no bedrooms) and
 * a flat (no land title) each render a sensible table rather than a grid of dashes.
 */
export default function KeyFacts({ property }) {
  const rows = [];

  rows.push({ label: "Reference", value: property.reference });
  rows.push({ label: "Type", value: humanise(property.propertyType) });

  // Room counts are meaningless on land and commercial stock.
  if (property.bedrooms > 0) {
    rows.push({ label: "Bedrooms", value: property.bedrooms });
    // Bathrooms and toilets are separate counts and genuinely differ — both shown.
    rows.push({ label: "Bathrooms", value: property.bathrooms });
    rows.push({ label: "Toilets", value: property.toilets });
  }

  if (property.boysQuarters > 0) {
    rows.push({ label: "Boys quarters", value: property.boysQuarters });
  }

  if (property.parkingSpaces > 0) {
    rows.push({ label: "Parking", value: `${property.parkingSpaces} spaces` });
  }

  // Always square metres — a "plot" denotes different areas by location.
  const area = formatArea(property.landSizeSqm);
  if (area) rows.push({ label: "Land size", value: area });

  if (property.titleType) {
    rows.push({ label: "Land title", value: humanise(property.titleType) });
  }

  // Rent terms carry real weight here: the advance requirement is often the deciding
  // factor, and it is legally capped at one year in Lagos.
  if (property.listingType === "rent" && property.rent?.advanceYears) {
    rows.push({
      label: "Advance",
      value: `${property.rent.advanceYears} year${property.rent.advanceYears === 1 ? "" : "s"}`,
    });
    rows.push({ label: "Rent period", value: formatRentPeriod(property.rent.period) });
  }

  if (property.landmark) {
    rows.push({ label: "Landmark", value: property.landmark });
  }

  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="bg-surface-raised px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">{row.label}</dt>
          <dd className="mt-1 text-ink tabular">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/property/AgentCard.jsx`**

```jsx
import { FiPhone, FiMessageCircle, FiUser } from "react-icons/fi";
import siteConfig from "@/config/site";

/**
 * The assigned agent, with the two contact routes that actually convert in this market:
 * a phone call and a WhatsApp click-to-chat link (scope §10 — click-to-chat, not the
 * Business API).
 *
 * `agent.photo` is frequently absent on real data, so an initial-free icon stands in.
 */
export default function AgentCard({ agent, property }) {
  // Fall back to the agency's own numbers when a listing has no assigned agent.
  const phone = agent?.phone ?? siteConfig.phone;
  const whatsapp = (agent?.whatsapp ?? siteConfig.whatsapp).replace(/\D/g, "");

  // Pre-filling the reference saves the prospect explaining which listing they mean.
  const whatsappMessage = encodeURIComponent(
    `Hello, I'm interested in ${property.title} (${property.reference}).`,
  );

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/5 text-muted">
          <FiUser size={22} aria-hidden="true" />
        </div>
        <div>
          <p className="text-ink">{agent?.name ?? siteConfig.name}</p>
          <p className="text-sm text-muted">{agent?.position ?? "Sales team"}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <a
          href={`tel:${phone}`}
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded bg-ink px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          <FiPhone size={16} aria-hidden="true" />
          Call {phone}
        </a>

        <a
          href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded border border-border px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
        >
          <FiMessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/app/property/[slug]/page.js`**

```jsx
import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import PropertyGallery from "@/components/property/PropertyGallery";
import PropertyGrid from "@/components/property/PropertyGrid";
import KeyFacts from "@/components/property/KeyFacts";
import AgentCard from "@/components/property/AgentCard";
import PropertyMap from "@/components/property/PropertyMap";
import EnquiryForm from "@/components/forms/EnquiryForm";
import { getProperty, getSettings } from "@/lib/api/server";
import { priceOf, statusLabel, coverImageOf } from "@/lib/property";
import { humanise } from "@/lib/format";
import { propertyMetadata, propertyJsonLd, breadcrumbJsonLd } from "@/lib/seo";

/**
 * Per-listing metadata: title, description, canonical URL and the Open Graph image.
 * Next 16: `params` is a Promise.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getProperty(slug);
  // A missing listing gets generic metadata; the page itself will 404.
  if (!data?.property) return { title: "Property not found" };
  return propertyMetadata(data.property);
}

/**
 * Property detail page — the conversion endpoint of the whole site.
 *
 * Server-rendered: this is the page organic search lands on, so the content, price and
 * structured data must all be in the initial HTML.
 */
export default async function PropertyPage({ params }) {
  const { slug } = await params;

  // The disclaimer is the one piece of chrome still read from the API — it carries
  // legal exposure (scope §11) and must match what the backend holds.
  const [data, settings] = await Promise.all([getProperty(slug), getSettings()]);

  // Drafts and soft-deleted listings return 404 from the API and must 404 here too —
  // a different response would leak that the reference exists.
  if (!data?.property) notFound();

  const { property, gallery = [], similar = [] } = data;
  const price = priceOf(property);
  const status = statusLabel(property.status);
  const cover = coverImageOf(property);

  // Gallery falls back to the cover image so a single-image listing still shows one.
  const images = gallery.length > 0 ? gallery : [{ _id: "cover", url: cover.url, alt: cover.alt }];

  return (
    <>
      {/* Structured data for the listing and its breadcrumb trail. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(propertyJsonLd(property)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(property)) }}
      />

      <Container className="py-8 md:py-12">
        {/* Breadcrumb — also the fastest route back to a broader search. */}
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm text-muted">
          <Link href="/" className="transition-colors duration-200 hover:text-ink">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/properties" className="transition-colors duration-200 hover:text-ink">
            Properties
          </Link>
          {property.location?.slug && (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={`/properties?location=${property.location.slug}`}
                className="transition-colors duration-200 hover:text-ink"
              >
                {property.location.name}
              </Link>
            </>
          )}
        </nav>

        <PropertyGallery images={images} title={property.title} />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem]">
          {/* Main column */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone="muted">{humanise(property.propertyType)}</Badge>
              <Badge tone="muted">
                {property.listingType === "rent" ? "To let" : "For sale"}
              </Badge>
            </div>

            <h1 className="mt-4 text-3xl text-ink md:text-4xl">{property.title}</h1>
            <p className="mt-3 text-ink-soft">
              {property.location?.name}, {property.state} — {property.landmark}
            </p>

            {/* Price block. The rent period is always spelled out. */}
            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-4xl text-ink tabular">{price.label}</span>
              {price.suffix && <span className="text-ink-soft">{price.suffix}</span>}
              {price.isNegotiable && <Badge tone="accent">Negotiable</Badge>}
            </div>

            <div className="mt-10">
              <h2 className="text-2xl text-ink">About this property</h2>
              {/* Capped line length keeps the description readable. */}
              <p className="mt-4 max-w-[68ch] whitespace-pre-line text-ink-soft">
                {property.description}
              </p>
            </div>

            <div className="mt-10">
              <h2 className="mb-5 text-2xl text-ink">Key facts</h2>
              <KeyFacts property={property} />
            </div>

            {/* Amenities come back as taxonomy terms with ready-made names. */}
            {property.tags?.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-5 text-2xl text-ink">Features and amenities</h2>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {property.tags.map((tag) => (
                    <li key={tag._id} className="flex items-center gap-2 text-ink-soft">
                      <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                      {tag.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10">
              <h2 className="mb-5 text-2xl text-ink">Location</h2>
              <PropertyMap
                coordinates={property.coordinates}
                landmark={property.landmark}
                title={property.title}
              />
            </div>

            {/* Statutory disclaimer — required on every property page (scope §11). */}
            {settings?.settings?.listingDisclaimer && (
              <p className="mt-12 max-w-[68ch] border-t border-border pt-6 text-sm text-muted">
                {settings.settings.listingDisclaimer}
              </p>
            )}
          </div>

          {/* Contact rail — sticky on desktop so the conversion path is always visible. */}
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <AgentCard agent={property.agent} property={property} />
            <EnquiryForm property={property} />
          </aside>
        </div>
      </Container>

      {/* Similar listings keep a visitor moving when this one is not right. */}
      {similar.length > 0 && (
        <Container className="pb-20">
          <h2 className="mb-8 text-2xl text-ink">Similar properties</h2>
          <PropertyGrid properties={similar} />
        </Container>
      )}
    </>
  );
}
```

- [ ] **Step 5: Commit (after Tasks 13 and 14 make it compile)**

```bash
git add frontend/src/app/property frontend/src/components/property
git commit -m "feat(frontend): property detail page with gallery, facts and agent contact"
```

---

## Task 13: Property map

**Files:**
- Create: `frontend/src/components/property/PropertyMap.jsx`
- Create: `frontend/src/components/property/MapCanvas.jsx`
- Modify: `frontend/package.json` (new dependencies)

**Interfaces:**
- Consumes: `property.coordinates` (`{ type: "Point", coordinates: [lng, lat] }` or null) and `property.landmark`.
- Produces: `<PropertyMap coordinates landmark title />`.

- [ ] **Step 1: Install the approved dependencies**

Run: `cd frontend && npm install leaflet react-leaflet`
Expected: both added to `dependencies`. These are the only new packages this plan authorises.

- [ ] **Step 2: Create `frontend/src/components/property/MapCanvas.jsx`**

```jsx
"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/**
 * The actual Leaflet canvas. Split from PropertyMap so the parent can load it with
 * ssr:false — Leaflet touches `window` at import time and cannot be server-rendered.
 *
 * OpenStreetMap tiles: free, and avoids Google Maps' dollar-denominated per-view
 * billing (scope §10).
 */

// Leaflet's default marker icon resolves image paths relative to the CSS, which the
// bundler rewrites — the icons 404 without this explicit definition.
const markerIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--color-accent);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapCanvas({ lat, lng, landmark, title }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      // Scroll-wheel zoom is off: a map that swallows page scroll is a usability trap.
      scrollWheelZoom={false}
      className="h-80 w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={markerIcon}>
        <Popup>
          {title}
          {landmark ? ` — ${landmark}` : ""}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/property/PropertyMap.jsx`**

```jsx
"use client";

import dynamic from "next/dynamic";
import { FiMapPin } from "react-icons/fi";

/**
 * Map pin for a listing.
 *
 * Loaded client-only: Leaflet reads `window` on import, so server rendering it throws.
 * The skeleton reserves the same height, so nothing reflows when the map arrives.
 */
const MapCanvas = dynamic(() => import("@/components/property/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-ink/5" />,
});

export default function PropertyMap({ coordinates, landmark, title }) {
  // Nigerian addresses geocode unreliably and many listings have no pin at all
  // (scope §10.2) — the landmark is the required field, so it stands alone here.
  const point = coordinates?.coordinates;

  if (!point || point.length !== 2) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-6">
        <FiMapPin size={20} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
        <div>
          <p className="text-ink">{landmark}</p>
          <p className="mt-1 text-sm text-muted">
            No map pin has been set for this listing. Call us for directions.
          </p>
        </div>
      </div>
    );
  }

  // GeoJSON order is [longitude, latitude]; Leaflet wants [lat, lng].
  const [lng, lat] = point;

  return (
    <div>
      <MapCanvas lat={lat} lng={lng} landmark={landmark} title={title} />
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <FiMapPin size={14} aria-hidden="true" />
        {landmark}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/property/PropertyMap.jsx frontend/src/components/property/MapCanvas.jsx
git commit -m "feat(frontend): leaflet map pin with landmark fallback"
```

---

## Task 14: Enquiry and viewing forms

**Files:**
- Create: `frontend/src/components/forms/FieldError.jsx`
- Create: `frontend/src/components/forms/EnquiryForm.jsx`
- Test: `frontend/src/components/forms/EnquiryForm.test.jsx`

**Interfaces:**
- Consumes: `submitEnquiry` (Task 5); `Button` (Task 6).
- Produces: `<EnquiryForm property />`, `<FieldError message />`.

- [ ] **Step 1: Create `frontend/src/components/forms/FieldError.jsx`**

```jsx
/**
 * Inline validation message, rendered directly beneath its field so the problem and
 * the fix are in the same place. `role="alert"` announces it to screen readers.
 */
export default function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-danger">
      {message}
    </p>
  );
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/components/forms/EnquiryForm.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EnquiryForm from "./EnquiryForm";

// The Axios client is the boundary — stub it, not axios itself.
const submitEnquiry = vi.fn();
vi.mock("@/lib/api/client", () => ({
  submitEnquiry: (...args) => submitEnquiry(...args),
}));

// Toasts are a side effect, not something these assertions care about.
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const property = {
  _id: "abc123",
  slug: "grand-5-bedroom-mansion-ref1009",
  title: "Grand 5 Bedroom Mansion",
  reference: "REF1009",
};

beforeEach(() => {
  submitEnquiry.mockReset();
});

describe("EnquiryForm", () => {
  it("requires a name and phone — email is optional in this market", async () => {
    const user = userEvent.setup();
    render(<EnquiryForm property={property} />);

    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it("submits the listing slug and the consent flag", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1", status: "new" });
    render(<EnquiryForm property={property} />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalledTimes(1));
    expect(submitEnquiry.mock.calls[0][0]).toMatchObject({
      name: "Chidi Nwosu",
      phone: "+2348012345678",
      property: "grand-5-bedroom-mansion-ref1009",
      type: "property_enquiry",
      source: "property_page",
      consentGiven: true,
    });
  });

  it("keeps marketing opt-in separate from contact consent", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1" });
    render(<EnquiryForm property={property} />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalled());
    // Agreeing to a callback is not agreeing to marketing alerts (NDPA, scope §11).
    expect(submitEnquiry.mock.calls[0][0].marketingOptIn).toBe(false);
  });

  it("maps the API's field-level details onto the offending inputs", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { phone: "Enter a valid Nigerian phone number" };
    submitEnquiry.mockRejectedValue(failure);
    render(<EnquiryForm property={property} />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "123");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    expect(
      await screen.findByText(/enter a valid nigerian phone number/i),
    ).toBeInTheDocument();
  });
});
```

> This test needs `@testing-library/user-event`. Check `frontend/package.json` — if it is absent, install it as a dev dependency (`npm install -D @testing-library/user-event`) and flag the addition; it is a Testing Library companion package, not a runtime dependency.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/forms/EnquiryForm.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `frontend/src/components/forms/EnquiryForm.jsx`**

```jsx
"use client";

import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { submitEnquiry } from "@/lib/api/client";

/**
 * Lead capture for a single listing — the conversion point of the entire site.
 *
 * Phone is required and email is not: phone is the primary contact channel in this
 * market. Contact consent is captured explicitly and marketing opt-in is a separate
 * checkbox, because agreeing to a callback is not agreeing to alerts (NDPA 2023,
 * scope §11).
 */
export default function EnquiryForm({ property }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      message: `I'd like more information about ${property.reference}.`,
      consentGiven: false,
      marketingOptIn: false,
    },
  });

  const onSubmit = async (values) => {
    try {
      await submitEnquiry({
        ...values,
        // The API resolves either a slug or an id; the slug is what we have here.
        property: property.slug,
        type: "property_enquiry",
        source: "property_page",
      });
      toast.success("Thanks — we'll be in touch shortly.");
      reset();
    } catch (error) {
      // The interceptor normalised this: `details` is the API's field error map.
      if (error.details) {
        for (const [field, message] of Object.entries(error.details)) {
          setError(field, { type: "server", message });
        }
        return;
      }
      // No field map means a general failure (rate limit, outage) — say so once.
      toast.error(error.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-border bg-surface-raised p-6"
      noValidate
    >
      <h2 className="text-xl text-ink">Enquire about this property</h2>
      <p className="mt-1 text-sm text-muted">We usually reply the same working day.</p>

      <div className="mt-6 space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm text-ink-soft">
            Your name
          </label>
          <input
            id="name"
            type="text"
            {...register("name", { required: "Name is required" })}
            aria-invalid={Boolean(errors.name)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.name?.message} />
        </div>

        {/* Phone — the primary channel, so it is required. */}
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-ink-soft">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            {...register("phone", { required: "Phone number is required" })}
            aria-invalid={Boolean(errors.phone)}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.phone?.message} />
        </div>

        {/* Email is genuinely optional — do not make it required "for completeness". */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-ink-soft">
            Email <span className="text-muted">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            {...register("email")}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 text-ink"
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Message, pre-filled with the reference so the enquiry is never ambiguous. */}
        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm text-ink-soft">
            Message
          </label>
          <textarea
            id="message"
            rows={4}
            {...register("message")}
            className="w-full rounded border border-border bg-surface p-3 text-ink"
          />
        </div>

        {/* Consent — explicit, and separate from marketing. */}
        <div className="space-y-3 pt-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              {...register("consentGiven", {
                required: "Please confirm we can contact you",
              })}
              className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
            />
            I&apos;m happy for us to contact you about this enquiry.
          </label>
          <FieldError message={errors.consentGiven?.message} />

          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              {...register("marketingOptIn")}
              className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
            />
            Send me new listings that match what I&apos;m looking for.
          </label>
        </div>
      </div>

      {/* Button disables and shows progress while the request is in flight. */}
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-6 w-full">
        {isSubmitting ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/forms/EnquiryForm.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/forms frontend/package.json
git commit -m "feat(frontend): property enquiry form with consent capture"
```

---

## Task 15: SEO — metadata, JSON-LD, sitemap, robots

**Files:**
- Create: `frontend/src/lib/seo.js`
- Create: `frontend/src/app/sitemap.js`
- Create: `frontend/src/app/robots.js`
- Modify: `frontend/src/app/layout.js` (Organization JSON-LD)

**Interfaces:**
- Consumes: `siteConfig`, `priceOf`, `coverImageOf`, `humanise`, `getProperties`.
- Produces: `propertyMetadata(property)`, `propertyJsonLd(property)`, `breadcrumbJsonLd(property)`, `organizationJsonLd()`.

- [ ] **Step 1: Create `frontend/src/lib/seo.js`**

```js
import siteConfig from "@/config/site";
import { coverImageOf, priceOf, isRental } from "@/lib/property";
import { humanise } from "@/lib/format";

/**
 * SEO helpers — page metadata and structured data.
 *
 * Organic search is the primary acquisition channel (scope §4.4), so this is a product
 * requirement rather than polish. Structured data is generated from the API record, so
 * it can never disagree with what the page displays.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Next `metadata` object for a listing: title, description, canonical, OG image. */
export function propertyMetadata(property) {
  const price = priceOf(property);
  const cover = coverImageOf(property);
  const url = `${SITE_URL}/property/${property.slug}`;

  // Front-load the facts a searcher scans in a result: type, area, price.
  const description = `${humanise(property.propertyType)} ${
    isRental(property) ? "to let" : "for sale"
  } in ${property.location?.name}, ${property.state}. ${price.label}${
    price.suffix ? ` ${price.suffix}` : ""
  }. ${property.description?.slice(0, 120) ?? ""}`.trim();

  return {
    title: property.title,
    description,
    // Canonical prevents filter-parameter variants competing with the listing itself.
    alternates: { canonical: url },
    openGraph: {
      title: property.title,
      description,
      url,
      type: "website",
      // A local placeholder is still a valid share image — better than none.
      images: [{ url: cover.url, alt: cover.alt }],
    },
  };
}

/** `RealEstateListing` structured data for a single property. */
export function propertyJsonLd(property) {
  const price = priceOf(property);
  const cover = coverImageOf(property);
  const rental = isRental(property);
  const amount = rental ? property.rent?.amount : property.price?.amount;

  const data = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: property.description,
    url: `${SITE_URL}/property/${property.slug}`,
    image: cover.url,
    datePosted: property.publishedAt,
    address: {
      "@type": "PostalAddress",
      addressLocality: property.location?.name,
      addressRegion: property.state,
      addressCountry: "NG",
    },
  };

  // Only emit an offer when there is a real figure — "price on request" is a genuine
  // state and inventing a 0 here would be a false claim in search results.
  if (amount != null) {
    data.offers = {
      "@type": "Offer",
      price: amount,
      priceCurrency: property.price?.currency ?? "NGN",
      availability:
        property.status === "available"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    };
  }

  if (property.bedrooms > 0) {
    data.numberOfBedrooms = property.bedrooms;
    data.numberOfBathroomsTotal = property.bathrooms;
  }

  if (property.landSizeSqm) {
    data.floorSize = {
      "@type": "QuantitativeValue",
      value: property.landSizeSqm,
      unitCode: "MTK", // UN/CEFACT code for square metre
    };
  }

  return data;
}

/** Breadcrumb trail matching the visible navigation on the detail page. */
export function breadcrumbJsonLd(property) {
  const items = [
    { name: "Home", url: SITE_URL },
    { name: "Properties", url: `${SITE_URL}/properties` },
  ];

  if (property.location?.slug) {
    items.push({
      name: property.location.name,
      url: `${SITE_URL}/properties?location=${property.location.slug}`,
    });
  }

  items.push({ name: property.title, url: `${SITE_URL}/property/${property.slug}` });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Site-level `RealEstateAgent` data, emitted once from the root layout. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    description: siteConfig.description,
    url: SITE_URL,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: { "@type": "PostalAddress", streetAddress: siteConfig.address, addressCountry: "NG" },
    sameAs: Object.values(siteConfig.socials).filter(Boolean),
  };
}
```

- [ ] **Step 2: Emit the Organization data in `frontend/src/app/layout.js`**

Add the import and place the script as the first child of `<body>`:

```jsx
import { organizationJsonLd } from "@/lib/seo";

// ...inside <body>, before <Header />:
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
```

- [ ] **Step 3: Create `frontend/src/app/sitemap.js`**

```js
import { getProperties } from "@/lib/api/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Auto-regenerating sitemap (scope §4.4).
 *
 * Only published, non-deleted listings appear — the API's public scope already
 * enforces that, so nothing extra is filtered here. The limit is the API's hard cap of
 * 48 per page; this walks pages until it has them all.
 */
export default async function sitemap() {
  const staticRoutes = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/properties`, changeFrequency: "daily", priority: 0.9 },
  ];

  const listings = [];
  let page = 1;
  let totalPages = 1;

  // Walk the paginated endpoint rather than requesting an unbounded page.
  do {
    const data = await getProperties({ page, limit: 48 });
    for (const property of data?.properties ?? []) {
      listings.push({
        url: `${SITE_URL}/property/${property.slug}`,
        lastModified: property.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    totalPages = data?.pagination?.pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return [...staticRoutes, ...listings];
}
```

- [ ] **Step 4: Create `frontend/src/app/robots.js`**

```js
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * robots.txt. The admin panel is disallowed pre-emptively — it is a later slice, but a
 * crawler finding it before the rule exists is harder to undo than adding it now.
 */
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run dev`, then:

```bash
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml | head -c 400
```

Expected: robots names the sitemap; the sitemap lists `/property/<slug>` URLs. Open a listing page and confirm two `application/ld+json` blocks in the HTML source.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/seo.js frontend/src/app/sitemap.js frontend/src/app/robots.js frontend/src/app/layout.js
git commit -m "feat(frontend): listing metadata, JSON-LD, sitemap and robots"
```

---

## Task 16: Error, not-found and final verification pass

**Files:**
- Create: `frontend/src/app/not-found.js`
- Create: `frontend/src/app/error.js`

**Interfaces:**
- Consumes: `Container`, `Button`.
- Produces: the global 404 and error boundary.

- [ ] **Step 1: Create `frontend/src/app/not-found.js`**

```jsx
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

/**
 * Global 404. Also what a draft or soft-deleted listing renders — deliberately
 * identical to a slug that never existed, so the response never leaks that a hidden
 * reference is real.
 */
export default function NotFound() {
  return (
    <Container className="py-28 text-center md:py-40">
      <p className="text-xs uppercase tracking-[0.08em] text-accent-text">404</p>
      <h1 className="mt-4 text-4xl text-ink md:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mx-auto mt-4 max-w-[52ch] text-ink-soft">
        The listing may have been taken off the market, or the link may be wrong.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button href="/properties">Browse listings</Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/error.js`**

```jsx
"use client";

import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

/**
 * Global error boundary. Must be a client component — Next requires it.
 *
 * The API's own message is never shown here: it can carry internal detail, and by this
 * point the visitor only needs a way forward.
 */
export default function Error({ reset }) {
  return (
    <Container className="py-28 text-center md:py-40">
      <h1 className="text-4xl text-ink md:text-5xl">Something went wrong</h1>
      <p className="mx-auto mt-4 max-w-[52ch] text-ink-soft">
        We couldn&apos;t load this page. Please try again — if it keeps happening, give
        us a call.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {/* reset() re-renders the segment without a full page reload. */}
        <Button onClick={() => reset()}>Try again</Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
```

- [ ] **Step 3: Run the full test suite and lint**

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all test files pass, including the harness smoke test.

- [ ] **Step 4: Production build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no type or import errors. Confirm `/properties` and `/property/[slug]` are listed as server-rendered (`ƒ`), not statically prerendered.

- [ ] **Step 5: Walk the design system checklist**

Against `/`, `/properties`, and a listing page, at 375 / 768 / 1024 / 1440:

- [ ] No emoji icons; every icon from `react-icons/fi`
- [ ] `cursor-pointer` on everything clickable
- [ ] Hover states cause no layout shift
- [ ] Focus ring visible when tabbing through
- [ ] Body text ≥ 16px on mobile; prose ≤ 75ch
- [ ] Gold never used as small text (only `--color-accent-text`)
- [ ] Status shown by label, not colour alone
- [ ] Every image has real alt text and reserved space
- [ ] No horizontal scroll at any breakpoint
- [ ] No brand string, colour, or font hardcoded in a component
- [ ] A rental card shows a period; an on-request listing shows no ₦0

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/not-found.js frontend/src/app/error.js
git commit -m "feat(frontend): 404 and error boundary"
```

---

## Self-review notes

**Spec coverage:** Foundation (Tasks 1, 6, 7) · data layer (5) · home + NL search (11) ·
search results with chips/relaxation/pagination/sort (9, 10) · property detail with
gallery, facts, amenities, map, agent, disclaimer (12, 13) · enquiry capture (14) ·
SEO metadata, JSON-LD, sitemap, robots (15) · gotcha guards (2, 3) · testing (2, 3, 4,
8, 14) · error states (16).

**Deliberately not in this plan** (spec §7): neighbourhood pages, agent profiles,
marketing pages, blog, admin panel. `ViewingRequestForm` is also deferred — the spec
lists it, but the enquiry form covers the same lead with fewer fields, and a viewing
request without an available-slot calendar is a worse version of the same conversation.
Build it with the enquiry inbox slice, when the admin side can actually action it.

**Dependency additions:** `leaflet`, `react-leaflet` (Task 13, pre-approved) and
possibly `@testing-library/user-event` (Task 14, dev-only, flag before installing).

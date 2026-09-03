# Frontend Phase 1 — Core Visitor Journey (Design)

Date: 2026-09-03
Scope: Sections 1–3 of the Phase 1 frontend decomposition, with SEO (section 5)
folded in as each page is built.

---

## 1. Decision record (from brainstorm)

| Decision | Choice | Reason |
| --- | --- | --- |
| Build slice | Foundation + home/search + property detail | The lead-gen path; everything else hangs off the shell |
| Visual direction | Premium & restrained — editorial, image-led, one accent, serif/sans pairing | Reads as a high-end Lagos agency; ages well as a template |
| Content source | **Local config/content modules, not the DB** — except data that is naturally DB | Client-staff editing is explicitly not a concern for this build; the pages/testimonials/settings routes do not exist |
| Theme source | Local: CSS custom properties in `globals.css` via Tailwind v4 `@theme` | Follows from the above; no `/api/settings` fetch in the root layout |
| Search state | URL `searchParams` are the single source of truth, fetched server-side | SSR on search/listing pages is a product requirement (§4.4) |
| Blog | **Deferred** | No backend routes; out of this slice |
| Map | **Add `leaflet` + `react-leaflet`** (new dependency, approved) | Free OSM tiles, no per-view billing (§10) |

### The DB / local line

**Naturally DB (fetch from the API):** properties, property media, locations,
taxonomy/filter options, agents attached to listings, price bounds — plus the write
endpoints (enquiries, viewings) and `POST /api/search`.

**Local to the repo:** hero copy, section headings, services/about/team/testimonials
text, legal copy, nav labels, brand colours, fonts, logo, agency name, contact details,
social links, decorative graphics, empty-state illustrations, placeholder images.

**One exception:** `listingDisclaimer` is read from `GET /api/settings` and rendered on
every property page. It is a legal-exposure field (§11) and must reflect what the
backend holds, not a copy in the component tree.

**Consolidation rule (§9):** local content and brand values live in exactly two places —
`src/config/site.js` (brand, contact, nav, social) and `src/content/*.js` (page copy).
No component holds a brand string or a marketing sentence inline. This keeps the
copy-the-repo-and-rebrand step to editing two modules, and leaves a single seam if a
future client's build wants these DB-driven instead.

---

## 2. Architecture

### 2.1 Directory layout

```
frontend/src/
  app/
    layout.js                  root layout: fonts, <Header/>, <Footer/>, <Toaster/>
    page.js                    homepage (server component)
    not-found.js  error.js  loading.js
    properties/
      page.js                  search results (server component, reads searchParams)
      loading.js
    property/[slug]/
      page.js                  detail (server component)
    sitemap.js  robots.js      Next file conventions
  components/
    layout/     Header, Footer, MobileNav, Container, Section
    property/   PropertyCard, PropertyGrid, PropertyGallery, PriceTag,
                KeyFacts, AmenityList, AgentCard, RelatedListings, PropertyMap
    search/     SearchBar (NL), FilterPanel, FilterChips, SortSelect, Pagination,
                RelaxationNotice, EmptyResults
    forms/      EnquiryForm, ViewingRequestForm, FieldError
    ui/         Button, Input, Select, Badge, Skeleton, Modal, Disclosure
  lib/
    api/server.js              server-side data layer (fetch + Next cache tags)
    api/client.js              shared Axios instance (browser only, withCredentials)
    format.js                  formatPrice, formatArea, formatRentPeriod
    property.js                priceOf(), isRental(), coverImageOf() — the gotcha guards
    seo.js                     metadata builders + JSON-LD helpers
    searchParams.js            parse/serialise URL <-> filter object
  config/site.js               brand, contact, nav, social, WhatsApp number
  content/                     home.js, legal.js — local page copy
```

### 2.2 Data layer — two clients, deliberately

- **`lib/api/server.js`** — used by server components. Plain `fetch` with Next 16
  caching (`revalidate` + tags), because Next's cache is fetch-based and Axios bypasses
  it. Exposes `getProperties(params)`, `getProperty(slug)`, `getFeatured()`,
  `getFilters()`, `getLocation(slug)`, `getSettings()`, `naturalSearch(body)`.
- **`lib/api/client.js`** — the shared Axios instance mandated by CLAUDE.md, used by
  client components for **writes only**: enquiry submit, viewing request. Configured
  `withCredentials: true`, JSON content type, base URL from
  `NEXT_PUBLIC_API_BASE_URL`. Interceptors normalise the failure envelope
  (`{ success:false, message, details }`) into a thrown error carrying `details`, so
  react-hook-form can map field errors with `setError`.

Both unwrap the `{ success, data }` envelope in exactly one place. No call site handles
a third shape.

### 2.3 Rendering strategy

| Route | Rendering | Cache |
| --- | --- | --- |
| `/` | Server component; featured rail fetched server-side | `revalidate: 300` |
| `/properties` | Server component, dynamic on `searchParams` | `revalidate: 60` |
| `/property/[slug]` | Server component; `generateStaticParams` deferred | `revalidate: 300` |

Interactive pieces (filter panel, gallery lightbox, mobile nav, forms, map) are client
components leaf-nested inside server components. The map is `dynamic(..., { ssr: false })`.

### 2.4 Search flow

`/properties?listingType=rent&location=lekki&bedroomsMin=3&sort=newest&page=2`

1. `searchParams.js` parses the URL into a filter object, dropping unknown keys.
2. If `q` is present, the server calls `POST /api/search`; otherwise `GET /api/properties`.
   Both return the same envelope, so the results renderer is shared.
3. `FilterPanel` (client) never fetches — it builds the next URL and calls
   `router.push`, so back/forward and link-sharing work.
4. `applied` chips render **what the visitor asked for**. If `relaxed` is non-empty, a
   `RelaxationNotice` sits above the grid saying the search was widened and to which
   rung — never by silently rewriting the chips.
5. `unmatched` terms are surfaced as "we didn't recognise: …" rather than dropped.

---

## 3. The Nigerian-market rendering rules (non-negotiable)

Straight from the API reference's gotchas, centralised in `lib/property.js` and
`lib/format.js` so no component re-implements them:

- **Never `if (property.price)`** — `price` is always truthy. Check `price.amount != null`.
- **Sale reads `price.amount`; rent reads `rent.amount`.** Different fields.
- **`rent.period` defaults to `per_annum`** — the Nigerian norm. Rendering a per-annum
  figure as "/month" is wrong by 12×. Always render the period explicitly.
- **`price.onRequest` / `isNegotiable` are real states.** Render "Price on request",
  never `₦0`, never hide the card.
- **Format as `₦150m` / `₦1.2b`**, not `₦150,000,000`. `currency` may be `USD` — never
  assume naira; read `price.currency`.
- **`bathrooms` and `toilets` are separate counts** and genuinely differ. Show both.
- **Guard optional media**: `coverImage.blurDataUrl`, `width`, `height` and `agent.photo`
  are absent on the seeded set. A local placeholder graphic covers the missing-cover case.
- **`documents` is never present** on public responses. No UI may expect it.

---

## 4. Component contracts

**`PropertyCard({ property })`** — the single listing representation, used by the
featured rail, the results grid, and related listings. Takes the card object from the
API verbatim. Renders cover (or placeholder), price via `priceOf()`, location, beds /
baths / toilets, area in m², status badge. Links to `/property/[slug]`. Never fetches.

**`FilterPanel({ options, value })`** — receives the `GET /api/filters` payload
(locations, types, amenities, real price bounds) plus the current filter object. Emits a
new URL. Stateless with respect to results; it never sees a property.

**`SearchBar({ variant })`** — free-text natural-language input. Submitting navigates to
`/properties?q=…`. Works with AI disabled (the default) because the backend's
deterministic parser handles it; no client-side branch on `aiSearchEnabled`.

**`EnquiryForm({ propertyId, agent })`** — react-hook-form, posts via the Axios client,
maps `details` onto fields, `react-hot-toast` on success. Renders the WhatsApp
click-to-chat and call buttons beside it.

**`PropertyMap({ coordinates, landmark })`** — client-only Leaflet pin. Falls back to
the landmark text alone when `coordinates` is null (common — §10.2).

---

## 5. SEO (folded into each page, not a later pass)

- `generateMetadata` per property: title, description, canonical, Open Graph image from
  the cover.
- JSON-LD: `RealEstateListing` on detail pages, `Organization` in the root layout,
  `BreadcrumbList` on detail pages.
- SEO-friendly slugs come from the API
  (`/property/4-bedroom-duplex-lekki-phase-1-REF1042`).
- `app/sitemap.js` enumerates published listings from the API; `app/robots.js` alongside it.
- A draft or soft-deleted listing 404s exactly like a non-existent one — the frontend
  must not distinguish them either.

---

## 6. Testing

Vitest + Testing Library, matching the existing harness. Vitest does not run the Next
compiler, so server components, routing and SSR are out of scope for these tests. Covered:

- `lib/format.js` and `lib/property.js` — a case per gotcha above, especially
  rent-vs-sale, `onRequest`, per-annum periods, USD, and the `₦150m` abbreviation.
- `lib/searchParams.js` — round-trip parse/serialise, unknown-key rejection.
- `PropertyCard` — renders a rental, a sale, an on-request listing and a
  missing-cover listing without throwing.
- `FilterPanel` — produces the expected URL for a given selection.
- `EnquiryForm` — maps a `details` payload onto field-level errors.

---

## 7. Out of scope for this slice

Neighbourhood pages, agent profiles, marketing pages (services / about / team /
testimonials / contact / list-with-us / legal), blog, and the entire admin panel. Blog
additionally needs backend routes that do not exist. These follow as separate slices.

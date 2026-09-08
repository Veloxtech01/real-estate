# Neighbourhood (area) pages — design spec

Date: 2026-09-08

## Problem

Scope doc §4.1 calls for "one page per neighbourhood... cheap to build, strong organic
traffic source." The data model, whitelist and public list/detail endpoints already
exist (`locationModel`, `GET /api/locations`, `GET /api/locations/:slug`), but there is
no frontend page — the homepage's "Browse by area" tiles link to a pre-filtered
`/properties?location=slug` search instead, exactly as that section's own comment
says: "because area landing pages are a later slice." This closes that gap.

## Scope

Frontend: two new routes (`/areas`, `/areas/[slug]`) plus a small edit to the existing
homepage section and the header/footer nav.

Backend: one bug fix (`getLocationBySlug` doesn't 404 on an unpublished area, unlike
every other resource) and a seed-data addition (a handful of locations get real
descriptions and `isPublished: true`, matching the `--demo` precedent for listings).

Explicitly **out of scope**:

- Cross-linking `PropertyCard`'s location line to the area page. `property.location`
  in the public API projection carries `slug` but not `isPublished`, so a card can't
  know whether linking there is safe without a further backend projection change.
  Left as a follow-up, not built here.
- Breadcrumbs. No other page in the site has them yet (About/Contact/Team/Blog all
  ship without); adding a breadcrumb system is a separate, cross-cutting SEO slice.
- An admin editor for `Location.description`/`isPublished`/`centre`. Same status as
  Testimonials before its endpoint shipped and as the marketing pages' `content/`
  files — curated by a direct database write until a content-admin slice exists.
- A location hierarchy view (`Location.parent` exists on the model but nothing here
  reads it — no area page shows "part of Lagos State" or similar).

## Backend

### `backend/controllers/referenceController.js` — `getLocationBySlug`

```js
export async function getLocationBySlug(req, res) {
  const location = await Location.findOne({ slug: req.params.slug }).lean();

  if (!location || !location.isPublished) {
    throw new ApiError(404, "Location not found");
  }
  // ...unchanged from here
}
```

Matches the convention already established for properties/agents/blog: a not-yet-public
record 404s identically to one that doesn't exist, so its URL can't be browsed or
guessed into before the copy is ready. `GET /api/locations` (the list endpoint) is
unaffected — it already takes an explicit `?published=true` rather than defaulting to
it, because the filter panel needs every area regardless of landing-page readiness.

**Test** (`backend/tests/api.property.test.js`, alongside the existing two location
tests): `GET /api/locations/:slug` for an unpublished area returns 404, matching the
existing "unknown slug" case exactly (no extra info that distinguishes "exists but
unpublished" from "doesn't exist").

### `backend/scripts/seedData.js` — `LOCATION_SEED`

Four entries gain `description` (2-3 sentences of genuine, non-agency-specific area
facts — commute/character/who-it-suits, not fabricated claims about this agency's
activity there, which is the same line Testimonials draws against invented client
quotes) and `isPublished: true`:

- Lekki Phase 1, Lagos
- Ikoyi, Lagos
- Victoria Island, Lagos
- Maitama, Federal Capital Territory

Spread across two states so the `/areas` index has more than one state group to
render, and chosen so at least one appears in the homepage's first-8 tile slice once
that slice is reordered (see below) regardless of alphabetical position.

`centre` coordinates are **not** added — no real ones are available, and the pattern
established for `siteConfig.officeCoordinates` (a flagged placeholder) doesn't fit a
seed script that's meant to be safe to run for a real client. The map on these four
pages is simply absent, same as it will be for every area until someone supplies real
coordinates — `MapCanvas` is conditionally rendered on `centre` being present, never on
a placeholder value.

`seed.js`'s `$setOnInsert` already protects existing edits on re-run — adding
`description`/`isPublished` to the seed objects flows through the same `...location`
spread with no controller change needed.

## Frontend

### `frontend/src/app/(site)/areas/page.js` (new)

Server component, following `contact/page.js`'s shape. Fetches
`getLocations({ published: true })`. Groups the result by `state` (the API already
sorts `{ state: 1, name: 1 }`, so grouping is a single reduce, not a re-sort) and
renders one `Section` per state with the state name as a sub-heading and a list of
`Link`s to `/areas/${slug}`.

Zero published locations → the page still renders (never a blank body), with an
`EmptyResults`-styled block: "We haven't published area guides yet" + a "Browse all
listings" button to `/properties`. Reuses `EmptyResults`'s visual pattern but isn't the
same component (its copy is about a search returning nothing, not about no areas
existing) — a small new block in the page, not a shared component split out for a
single caller.

`metadata`: title "Areas we cover", description drawn from a new
`content/areas.js` intro line (same content-source convention as About/Contact).

### `frontend/src/app/(site)/areas/[slug]/page.js` (new)

Server component, following `property/[slug]/page.js`'s notFound() pattern (the
existing one for a resource whose API 404s on draft/missing):

```js
export default async function AreaPage({ params }) {
  const { slug } = await params; // Next 16: params is a Promise
  const location = await getLocation(slug);
  if (!location) notFound();

  const [properties] = await Promise.all([
    getProperties({ location: slug, limit: 12, sort: "newest" }),
  ]);
  // ...
}
```

`getLocation(slug)` is a new one-line addition to `lib/api/server.js`, mirroring
`getBlogPost`'s shape (`request` already returns `null` on a 404, which `request()`'s
existing doc comment says is exactly how the caller is meant to turn it into
`notFound()`).

Layout, two bands:

1. `tone="dark"` — eyebrow "Areas we cover", `location.name` as title, `location.state`
   as a small caption line, `location.description` rendered `whitespace-pre-line`
   (matches About's story block — plain text, not Markdown; the schema field is a plain
   trimmed `String`). `MapCanvas` (via a new thin `AreaMap` wrapper copying
   `OfficeMap`'s dynamic-import-for-Server-Component pattern) renders only when
   `location.centre` is present — omitted entirely otherwise, never a placeholder pin.
2. `tone="light"` — a count line ("12 available listings in Lekki Phase 1" /
   singular-aware), then `PropertyGrid` when `propertyCount > 0`, otherwise a small
   empty block ("No listings in this area right now — browse everywhere" + a button to
   `/properties`), same reasoning as the index page's empty state.

`metadata`: `location.metaTitle ?? \`${location.name} — Areas we cover\`` and
`location.metaDescription ?? location.description ?? \`Homes and land in
${location.name}, ${location.state}.\`` — the same generated-fallback pattern
`blog/[slug]/page.js` already uses for posts without an explicit meta override.

**Test**: none for either page — matches the established precedent that
`contact/page.js`/`about/page.js` have no page-level test (coverage lives in shared
components: `PropertyGrid`, `EmptyResults`, and the new empty-state block get exercised
indirectly through this page but aren't tested here specifically, same as those pages'
existing components).

### `frontend/src/content/areas.js` (new)

```js
{ eyebrow: "Where we operate", title: "Areas we cover", intro: "..." }
```

Same shape/status as `about.js`/`contact.js` — hardcoded copy, not `pageModel`-backed,
per the existing marketing-pages convention note in CLAUDE.md.

### `frontend/src/app/(site)/page.js` — "Browse by area" section

Two changes to the existing block (lines ~36-46, ~75-103):

1. **Tile href**: `area.isPublished ? \`/areas/${area.slug}\` : \`/properties?location=${area.slug}\`` — a published area gets the richer landing page; an unpublished one keeps today's behaviour exactly (a pre-filtered search, never a link to a page that would 404).
2. **Tile ordering**: the areas array is built as published locations first, then the rest, before the `.slice(0, 8)` — otherwise alphabetical `state` sort could bury every published area past the 8-tile cutoff (as it currently would: Enugu/FCT sort before Lagos). `getLocations()` stays the unfiltered call it already is (the comment explaining why is still correct — unpublished areas remain valid pre-filtered-search destinations), just reordered client-side in the page before slicing.

The doc comment "ivory areas... area landing pages are a later slice" gets updated —
they're not later anymore for the published ones.

### `frontend/src/config/site.js`

- `nav`: remove `About`, `Team`, `Contact` entries (they stay reachable via the footer's
  Company column, which already lists all three). Resulting header nav: Buy, Rent, All
  listings, Services, Blog.
- `footerLinks`: add `{ href: "/areas", label: "Areas we cover" }` to the "Explore"
  column (grouped with the other browse-by-facet links — Homes for sale/to let,
  Featured, All listings — rather than "Company", since this is a browsing entry point
  like those, not a company-info page like About/Team/Contact).

## Testing

**Backend**: the one new 404 test described above. No other backend behaviour changes.

**Frontend**: no new component tests — this slice is server components rendering
existing, already-tested pieces (`PropertyGrid`, `Section`, `Button`) plus new markup
too thin to warrant isolated tests (a heading, a description paragraph, a conditional
map). Verified manually in-browser instead: `/areas` index renders the four published
locations grouped by state, `/areas/lekki-phase-1-lagos` renders its description and a
live grid of Lekki listings, an unpublished slug 404s, the homepage tiles for published
areas route to `/areas/...`, and the header/footer nav changes render correctly.

## Status doc updates (on completion)

- CLAUDE.md status block: add a bullet for neighbourhood pages next to the marketing-
  pages bullet, and remove them from the "Not built" line (leaving just the §4.3 daily
  digest there).
- CLAUDE.md's public-site-conventions note about the homepage areas section ("area
  landing pages are a later slice") needs updating to describe the new behaviour.
- `docs/API-REFERENCE.md`: update the `GET /api/locations/:slug` entry to note the
  404-on-unpublished behaviour.

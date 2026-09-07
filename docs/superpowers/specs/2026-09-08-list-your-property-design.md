# List your property with us — design spec

Date: 2026-09-08

## Problem

Scope doc §3 calls "List your property with us" the agency's supply pipeline —
"arguably the most commercially valuable page" — but it doesn't exist. The header,
mobile nav, and homepage CTA all point `siteConfig.listPropertyHref` at a WhatsApp
deep link instead, with a comment in `config/site.js` explicitly flagging this as a
placeholder to be swapped once the route ships.

## Scope

A frontend-only slice. The backend already anticipates this feature:
`ENQUIRY_TYPES` includes `"list_property"` and `ENQUIRY_SOURCES` includes
`"list_property_page"` in `backend/utils/constants.js`, and `enquiryModel.requirement`
is a free-form `Mixed` field with no current writer anywhere in the frontend (the §5.5
"notify me" no-match alert isn't built either). No model, route, or controller changes
are needed — `POST /api/enquiries` already accepts an arbitrary `type`/`source`/
`requirement` and validated `name`/`phone` are its only requirements.

Explicitly **out of scope**:

- Any backend change.
- A dedicated seller/landlord admin queue — these leads land in the same
  `/admin/enquiries` inbox as everything else, filterable by `type` like any other.
- Structured location matching — the location field is free text (see decision below).

## Decision: location is free text, not a dropdown

The existing locations list (`GET /api/filters`) only covers areas the agency already
operates in. A seller's property may be anywhere in Nigeria, and a lead from an
uncovered area is exactly the kind of signal worth capturing to expand supply — a
dropdown would silently discard those. `location` is a plain text input.

## Frontend

### `frontend/src/content/listYourProperty.js` (new)

Copy object, same shape as `content/about.js`/`content/contact.js`:

```js
{
  eyebrow, title, intro,          // dark-band hero copy
  pitch: { heading, body },       // short paragraph on why list with this agency
  trustPoints: [{ title, body }], // 3 seller-facing bullets, distinct from About's
                                  // buyer-facing "What you can expect" points
  form: { heading, subheading },
}
```

All copy is **placeholder**, flagged in a leading comment the same way `about.js`/
`home.js` are — the agency hasn't supplied seller-specific differentiators yet.

### `frontend/src/app/(site)/list-your-property/page.js` (new)

Server component, following `contact/page.js`'s shape:

- Sets `metadata` (`title`, `description`) from the content file. Root layout's title
  template appends the site name — don't repeat it.
- Calls `getFilters()` from `lib/api/server.js` (the fetch-based server client — same
  call the homepage already makes for `HeroSearchPanel`) to get `propertyTypes` for the
  form's select.
- Renders two `Section`s:
  1. `tone="dark"` — eyebrow/title/intro from content, the pitch paragraph, and the 3
     trust points as a simple 3-column grid (reuse whatever grid pattern About's
     "values.points" uses, not a new layout primitive).
  2. `tone="light"` — `<ListPropertyForm propertyTypes={options.propertyTypes} />` in
     a card, matching Contact's form-card styling.

### `frontend/src/components/forms/ListPropertyForm.jsx` (new)

Client component, react-hook-form, modelled on `EnquiryForm.jsx` but not built by
extending it — the field set differs enough (structured property details vs. a single
message) that forcing one shared component would leave conditional cruft in both call
sites. Shared pieces (`FieldError`, `Button`, the consent/marketing-opt-in checkbox
pair, the submit-and-toast pattern) are copied at the same fidelity `EnquiryForm`
already established, not abstracted into a new shared hook — three near-identical
checkboxes across two files doesn't justify one.

Props: `{ propertyTypes }` (array of type keys from `GET /api/filters`, humanised for
display the same way `HeroSearchPanel` does).

Fields, in order:

1. **`listingType`** — `<select>`, `sale` / `rent`, hardcoded pair (no separate
   `listingTypes` list exists in `/api/filters`; `HeroSearchPanel` hardcodes the same
   pair inline). Required.
2. **`propertyType`** — `<select>` from `propertyTypes` prop, `humanise()`d labels,
   `""` = "Not sure yet" (optional — a seller may not know the agency's exact taxonomy
   term).
3. **`location`** — free text, label "Property location (area, city, state)". Required.
4. **`bedrooms`** — `<select>`, same `BEDROOM_OPTIONS = [1,2,3,4,5]` ladder as
   `HeroSearchPanel`, captioned "(if applicable)". Optional.
5. **`expectedPrice`** — `<input type="number">`, label switches on the watched
   `listingType` value: "Expected sale price (₦)" when `sale`/unset, "Expected annual
   rent (₦)" when `rent` — the per-annum norm this codebase already treats as
   canonical for rent (scope §8.2). Optional.
6. **`name`**, **`phone`** (required, same messages as `EnquiryForm`), **`email`**
   (optional), **`message`** (optional, label "Anything else we should know?").
7. **`consentGiven`** (required checkbox), **`marketingOptIn`** (optional checkbox) —
   identical copy/behaviour to `EnquiryForm`.

On submit:

```js
await submitEnquiry({
  name, phone, email, message,
  consentGiven, marketingOptIn,
  type: "list_property",
  source: "list_property_page",
  requirement: {
    listingType,
    ...(propertyType ? { propertyType } : {}),
    location,
    ...(bedrooms ? { bedrooms: Number(bedrooms) } : {}),
    ...(expectedPrice ? { expectedPrice: Number(expectedPrice) } : {}),
  },
});
```

Optional empty fields are omitted from `requirement` rather than sent as `""`/`NaN` —
an admin reading this lead later shouldn't see `"bedrooms": ""`.

Success/error handling is identical to `EnquiryForm`: `toast.success` + `reset()` on
201; a 400's `error.details` maps onto fields via `setError`; anything else surfaces
as `toast.error(error.message)`.

### `frontend/src/config/site.js`

```js
listPropertyHref: "/list-your-property",
```

Replaces the WhatsApp deep link. The header `Button`, `MobileNav`, and homepage CTA
band all read this constant already — no other change needed, confirming the comment
already left at this line.

### `frontend/src/config/site.js` — `footerLinks`

Add `{ href: "/list-your-property", label: "List your property" }` to the "Company"
column, alongside About/Services/Team/Contact — footer links only point at routes that
exist, and this one now does.

## Testing

**Frontend** (vitest + Testing Library):

- `ListPropertyForm.test.jsx` (mirrors `EnquiryForm.test.jsx`):
  - Renders all fields; `propertyTypes` prop populates the select.
  - Submitting with only required fields (`listingType`, `location`, `name`, `phone`,
    `consentGiven`) sends a `requirement` object containing just `listingType` and
    `location`.
  - Filling `bedrooms`/`expectedPrice` includes them in `requirement` as numbers.
  - Changing `listingType` to `rent` switches the price field's label to "Expected
    annual rent (₦)".
  - A mocked 400 with `details: { phone: "..." }` renders next to the phone input.
  - Missing required fields block submission client-side (react-hook-form `required`).
- No page-level test for `list-your-property/page.js` — neither `contact/page.js` nor
  `about/page.js` has one; coverage lives in the form/content component tests, and this
  page follows that precedent rather than introducing a new one.

No backend tests: nothing in `backend/` changes.

## Status doc updates (on completion)

- CLAUDE.md status block: add a bullet for the list-your-property page next to the
  other marketing-pages bullets, noting it reuses the existing enquiry pipeline with no
  backend change, and that `requirement` is now populated by a real caller for the
  first time.
- CLAUDE.md's public-site-conventions note about `listPropertyHref` opening WhatsApp
  "until the §3 page exists" is now stale — update it to describe the built page.
- `docs/PROJECT-SCOPE.md` needs no change — this closes an existing §3/§4.1 bullet
  rather than deviating from it.
- `docs/API-REFERENCE.md` needs no change — no endpoint or response shape changed.

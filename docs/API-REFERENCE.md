# API Reference

Response shapes for the built backend, captured from the running API against the
seeded `realestate_dev` database — not written from memory.

Read this before building any page that consumes the API. Endpoint paths, query
params and the behavioural rules live in [CLAUDE.md](../CLAUDE.md); this file is
about **what comes back**.

Base URL comes from `NEXT_PUBLIC_*` env (see CLAUDE.md — never hardcode `localhost`).
Backend runs on **:5000**, Next.js on **:3000**.

---

## Response envelope

Every endpoint uses one of two shapes. There are no exceptions — don't write a
call site that handles a third.

```jsonc
// Success
{ "success": true, "data": { /* ... */ } }

// Failure
{
  "success": false,
  "message": "Name and phone number are required",
  "details": { "name": "Name is required" },  // only for field-level validation
  "stack": "..."                               // development only, stripped in production
}
```

`details` is present only when there are per-field errors — use it to place messages
next to inputs in react-hook-form.

---

## Gotchas that will bite the frontend

1. **`price` is always truthy, even on rentals.** Schema defaults mean a rent listing
   returns `price: { currency: "NGN", isNegotiable: false, onRequest: false }` with no
   `amount`. **Check `price.amount != null`, never `if (property.price)`.**
2. **`price.onRequest` and `price.isNegotiable` are real states** (§8.2), not missing
   data. A listing can be published with no figure at all — render "Price on request",
   don't render `₦0` or hide the card.
3. **Rent lives on `rent.amount`, sale on `price.amount`.** They are different fields.
   `rent.period` is `per_annum` by default — the Nigerian norm — so a naive
   "₦400,000/month" render is wrong by 12×.
4. **Format prices as `₦150m`, not `₦150,000,000`** (§8.2 — how Nigerian buyers read
   them). `price.currency` can be `USD` on high-end stock; never assume naira.
5. **`bathrooms` and `toilets` are separate counts** and genuinely differ. Show both.
6. **Optional media fields are frequently absent** on real data: `coverImage.blurDataUrl`,
   `width`, `height`, and `agent.photo` are all missing on the seeded set. Guard them.
7. **`documents` is never present** on public responses (`select: false`). Don't build
   UI expecting it.
8. **`applied` chips reflect what the visitor asked for, not the relaxed search.** If
   `relaxed` is non-empty, results are deliberately broader than the chips — say so in
   the UI rather than silently showing mismatched results.

---

## `GET /api/properties` — search

`data` keys: `properties`, `pagination`, `applied`, `relaxed`, `unmatched`.

### Property card object

```jsonc
{
  "_id": "6a99b58...",
  "reference": "REF1009",
  "title": "Grand 5 Bedroom Mansion in Akobo",
  "slug": "grand-5-bedroom-mansion-in-akobo-ref1009",   // the SEO URL segment
  "description": "...",
  "listingType": "rent",            // "sale" | "rent"
  "propertyType": "detached",
  "status": "available",            // available | under_offer | sold | rented | off_market
  "publicationState": "published",
  "deletedAt": null,
  "isFeatured": false,
  "state": "Oyo",
  "landmark": "Near Akobo, Ibadan", // always present, required by the schema
  "bedrooms": 5,
  "bathrooms": 5,
  "toilets": 5,
  "boysQuarters": 1,
  "parkingSpaces": 4,
  "landSizeSqm": 650,               // ALWAYS square metres — convert for display
  "price": { "currency": "NGN", "isNegotiable": false, "onRequest": false },
  "rent":  { "amount": 400000, "period": "per_annum", "advanceYears": 1 },
  "infrastructure": {
    "power": [], "water": ["public_supply"],
    "hasFloodHistory": false, "isGatedEstate": false
  },
  "tags": [
    { "_id": "...", "key": "walk_in_closet", "name": "Walk-in closet", "category": "amenity" }
  ],
  "location": { "_id": "...", "name": "Akobo", "slug": "akobo-oyo", "state": "Oyo", "lga": "Lagelu" },
  "agent": {
    "_id": "...", "name": "Ifeanyi Eze", "slug": "ifeanyi-eze",
    "phone": "+2348067067228", "whatsapp": "+2348067067228", "position": "Sales Consultant"
  },
  "coverImage": { "_id": "...", "url": "...", "thumbnailUrl": "...", "alt": "..." },
  "viewCount": 0,
  "publishedAt": "2026-01-22T00:00:00.000Z",  // order "recent listings" by THIS, not createdAt
  "createdAt": "...", "updatedAt": "..."
}
```

> Note `location.slug` carries a state suffix (`akobo-oyo`) because area names repeat
> across states. The API accepts the bare name too — `?location=akobo` resolves.

### `pagination`

```jsonc
{ "page": 1, "limit": 12, "total": 68, "pages": 6 }
```

Default `limit` is 12, hard-capped at 48.

### `applied` — the filter chips (§5.2 step 7)

Render these as removable chips so the visitor can see and correct how their request
was read.

```jsonc
{
  "listingType": "sale",
  "propertyType": ["apartment"],
  "bedroomsMin": 3,
  "priceMax": 200000000,
  "status": "available",
  "locations": [{ "id": "...", "name": "Lekki Phase 1", "slug": "lekki-phase-1-lagos", "state": "Lagos" }],
  "amenities": [{ "id": "...", "key": "swimming_pool", "name": "Swimming pool", "category": "amenity" }]
}
```

### `relaxed` and `unmatched`

- `relaxed`: `[]`, or rungs of the §5.5 ladder in order — `"price_band"`,
  `"nearby_areas"`, `"bedrooms"`. Non-empty means **tell the visitor** what was
  widened ("No exact matches — showing nearby areas in Lagos").
- `unmatched`: terms the site doesn't cover, e.g. `["yenagoa"]`. Surface it
  ("We don't cover Yenagoa yet") rather than silently ignoring it.

---

## `GET /api/properties/:slug` — detail

```jsonc
{ "success": true, "data": { "property": { /* as above */ }, "gallery": [ /* ... */ ], "similar": [ /* cards */ ] } }
```

`gallery` items are ordered by `displayOrder`:

```jsonc
{ "_id": "...", "property": "...", "url": "...", "thumbnailUrl": "...",
  "alt": "...", "type": "image", "displayOrder": 0, "publicId": "demo/REF1009/1" }
```

`similar` is up to 4 cards in the same area and listing type. **404s for drafts and
soft-deleted listings**, identically to a nonexistent slug.

---

## `GET /api/properties/featured`

`{ "success": true, "data": { "properties": [ /* cards */ ] } }` — `?limit=` default 6, max 12.

---

## `GET /api/filters` — everything the filter panel needs, in one call

```jsonc
{
  "listingTypes": ["sale", "rent"],
  "propertyTypes": ["apartment", "mini_flat", "self_contained", "room_and_parlour",
                    "duplex", "terrace", "semi_detached", "detached", "bungalow",
                    "penthouse", "boys_quarters", "land", "commercial"],
  "titleTypes": ["c_of_o", "governors_consent", "deed_of_assignment", "registered_survey",
                 "excision", "gazette", "family_land", "global_c_of_o"],
  "rentPeriods": ["per_annum", "per_quarter", "per_month"],
  "currencies": ["NGN", "USD"],
  "locations": [{ "_id": "...", "name": "Ajah", "slug": "ajah-lagos", "state": "Lagos" }],
  "taxonomy":  [{ "_id": "...", "key": "swimming_pool", "name": "Swimming pool", "category": "amenity" }],
  "priceRange": { "sale": { "min": 0, "max": 701000000 }, "rent": { "min": 0, "max": 3400000 } }
}
```

`priceRange` is computed from live stock, and sale/rent differ by orders of magnitude —
use **separate sliders**, not one.

Enum values are machine keys. The UI supplies the human labels (`self_contained` →
"Self-contained"); the API deliberately doesn't, so labels stay a presentation concern.

---

## `GET /api/locations` · `GET /api/locations/:slug`

- List: `{ "locations": [{ "_id", "name", "slug", "state", "lga", "description", "isPublished" }] }`.
  `?state=Lagos`, `?published=true`.
- Detail: `{ "location": { ... }, "propertyCount": 12 }` — count is available listings only.

## `GET /api/taxonomy`

Grouped by category, ready for filter-panel sections:

```jsonc
{ "taxonomy": { "amenity": [...], "facility": [...], "security": [...], "feature": [...] } }
```

---

## `GET /api/agents` · `GET /api/agents/:slug`

Public team roster and per-agent profile/referral pages (§3). `isPublic && isActive`
only — a private or inactive agent 404s identically to an unknown slug.

- List: `{ "agents": [{ "_id", "name", "slug", "photo", "position", "bio", "phone",
  "whatsapp", "registrationNumber", "areas": [{ "_id", "name", "slug" }] }] }`.
- Detail: `{ "agent": { ...same shape } }`.
- Never exposes `email`, `password`, `role`, `canPublish`, or `lastLoginAt`.

---

## `GET /api/testimonials`

Agency-curated client feedback (§3) — never a public review system; entries are
staff-entered and there is no submission path. Published only, in curator-set order.

`{ "testimonials": [{ "_id", "clientName", "clientTitle", "quote", "photo", "rating" }] }`.
`?limit=` caps the count. An empty array is a legitimate answer, not an error — the
homepage's `Testimonials` component renders nothing until at least one is curated.

---

## `GET /api/blog` · `GET /api/blog/:slug`

Public blog index and post pages (§4.1). Published + non-deleted only — a draft, a
soft-deleted post, and an unknown slug all 404 identically.

- List: `{ "posts": [{ "_id", "title", "slug", "excerpt", "coverImage", "categories",
  "tags", "author": { "_id", "name", "slug", "photo", "position", "isPublic",
  "isActive" } | null, "publishedAt" }], "pagination": { "page", "limit", "total",
  "pages" } }`. `?page=` and `?limit=` (default 9, capped at 24).
- Detail adds `body` (Markdown source — rendered with `react-markdown` on the
  frontend, never `dangerouslySetInnerHTML`), `metaTitle`, `metaDescription`,
  `ogImage`, `updatedAt`.
- **Only link to `/team/:slug` when `author.isPublic && author.isActive`** — an
  author can reference a staff member who was later made private or deactivated, and
  the profile page would 404 for that slug just like `/api/agents/:slug` does.

---

## `GET /api/settings` — site chrome and theme

```jsonc
{ "settings": {
  "agencyName": "Your Agency Name", "tagline": "...",
  "lasreraNumber": null, "registrationNumbers": [],
  "email": null, "phone": null, "whatsapp": null, "address": null,
  "coordinates": null, "officeHours": [], "socialLinks": {},
  "theme": {
    "colors": { "primary": "#0f172a", "accent": "#0ea5e9", "surface": "#ffffff", "muted": "#f1f5f9" },
    "fontHeading": "system-ui", "fontBody": "system-ui",
    "logoUrl": null, "faviconUrl": null, "homepageVariant": "default"
  },
  "footerText": null,
  "listingDisclaimer": "The agency does not warrant title...",
  "aiSearchEnabled": false
} }
```

**`theme` is the §9 contract.** Emit `theme.colors` as CSS custom properties and read
them everywhere. No component may hardcode a brand colour, font, logo or the agency
name — that is what makes a copied repo rebrandable from one place.

`listingDisclaimer` must appear on every property page (§11).
The AI spend cap, current spend and analytics IDs are deliberately **not** exposed.

---

## `POST /api/search` — natural-language search

Body: `{ "q": "3 bedroom flat in Lekki under 100m", "page": 1, "limit": 12, "sort": "newest" }`

Returns everything `GET /api/properties` does, plus:

```jsonc
"interpretation": { "parsedBy": "parser", "cacheHit": false }
```

`parsedBy` is `"parser"` | `"model"` | `"hybrid"`. **Works with AI disabled** (the
current default) — the deterministic parser handles prices, "to let", property types
and land titles, and place names are matched against the locations table.

400s on a missing phrase or one over 500 characters.

---

## `POST /api/enquiries` — lead capture

```jsonc
// request
{ "name": "Chidi Nwosu", "phone": "+2348012345678", "email": "chidi@example.com",
  "message": "Is this still available?", "property": "<slug or id>",
  "type": "property_enquiry", "source": "property_page",
  "consentGiven": true, "marketingOptIn": false,
  "requirement": { }  // only for the §5.5 no-match alert
}

// 201
{ "success": true, "data": { "enquiry": { "id": "...", "type": "...", "status": "new", "createdAt": "..." } } }
```

- **Required:** `name`, `phone`. Email is optional — phone is the primary channel here.
- `type`: `property_enquiry` | `list_property` | `valuation_request` | `general`.
  `list_property` is the landlord/seller pipeline (§3).
- `source`: `property_page` | `contact_page` | `list_property_page` | `area_page` |
  `agent_page` | `no_match_alert`.
- **Capture `consentGiven` explicitly** in the form (NDPA 2023, §11), and keep
  marketing opt-in a *separate* checkbox — agreeing to a callback is not agreeing to
  alerts.
- 404 if `property` doesn't resolve. Unknown `type`/`source` fall back to defaults
  rather than failing — a stale frontend never costs a lead.
- Responds **before** sending email, so a slow mail provider won't slow the form.

## `POST /api/viewings`

```jsonc
{ "property": "<slug or id>", "name": "...", "phone": "...",
  "email": "...", "requestedFor": "2026-10-01T10:00:00Z" }
```

`property`, `name`, `phone`, `requestedFor` all required; the date must be in the
future. Returns `{ "viewing": { "id", "status": "requested", "requestedFor" } }`.

Both lead endpoints are rate-limited to **20 requests / 15 min** per IP. Surface a
friendly message on 429 rather than a raw error.

---

## Authenticated endpoints (admin panel)

Auth is an **httpOnly cookie** (`re_token`) — the token is never in a response body and
is unreadable from JS. The shared Axios instance must set `withCredentials: true`.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` → `{ user: { id, name, email, role, canPublish } }` |
| POST | `/api/auth/logout` | Clears the cookie |
| GET | `/api/auth/me` | Restores session on reload; 401 when signed out |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }`; **signs the session out** |
| GET/POST | `/api/admin/properties` | Table (incl. drafts, `?includeDeleted=true`) / create |
| GET | `/api/admin/properties/:id` | One listing **plus its media gallery** — what the editor loads |
| PATCH/DELETE | `/api/admin/properties/:id` | Update / **soft** delete |
| POST | `/api/admin/properties/:id/restore` | Undo soft delete |
| POST | `/api/admin/properties/:id/feature` | **Administrator only** (403 for agents) |
| GET | `/api/admin/reference` | Every enum, the rent-rule table, land-unit factors, areas, taxonomy, staff |
| GET/POST | `/api/admin/staff` | **Administrator only.** Full roster incl. inactive / create a staff account |
| GET/PATCH | `/api/admin/staff/:id` | **Administrator only.** One account / update, deactivate, reset password |

- `role` is `administrator` | `agent`. Agents see and edit **only their own** listings.
- An agent with `canPublish: false` gets **403** when setting `publicationState:
  "published"` — the admin UI should hide or disable that control for them.
- Login is throttled to 10 failed attempts / 15 min.
- Expect a **401 at any time** (deactivated account, expired token) — handle it in the
  Axios interceptor and redirect to login, not per call site.

Local admin credentials are in `backend/.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

### `GET /api/admin/properties/:id` — the listing editor's load

```json
{
  "success": true,
  "data": {
    "property": {
      "_id": "6a99b588fcd254d91ec3ad0a",
      "reference": "REF1009",
      "title": "Grand 5 Bedroom Mansion in Akobo",
      "slug": "grand-5-bedroom-mansion-in-akobo-REF1009",
      "listingType": "rent",
      "propertyType": "detached_house",
      "status": "available",
      "publicationState": "published",
      "deletedAt": null,
      "isFeatured": false,
      "state": "Oyo",
      "landmark": "…",
      "price": { "currency": "NGN", "isNegotiable": false, "onRequest": false },
      "rent": { "amount": 4500000, "period": "per_annum", "advanceYears": 1 },
      "infrastructure": { "power": ["grid_band_a"], "water": ["borehole"] },
      "location": { "_id": "…", "name": "Akobo", "slug": "akobo-oyo", "state": "Oyo" },
      "agent": { "_id": "…", "name": "Ifeanyi Eze", "slug": "ifeanyi-eze" },
      "tags": [{ "_id": "…", "key": "walk_in_closet", "name": "Walk-in closet", "category": "amenity" }],
      "coverImage": { "_id": "…", "url": "…", "thumbnailUrl": "…", "alt": "…" }
    },
    "media": [
      {
        "_id": "…",
        "property": "…",
        "url": "…",
        "publicId": "…",
        "thumbnailUrl": "…",
        "type": "image",
        "alt": "…",
        "displayOrder": 0
      }
    ]
  }
}
```

- **`location`, `agent`, `tags` and `coverImage` come back populated here**, but a
  create/update response returns them as **bare ids**. Anything loading a form from
  both has to handle each — see `toFormValues` in `frontend/src/lib/propertyForm.js`.
- `media` is sorted by `displayOrder` and is the array the cover picker renders. Empty
  on any listing created since seeding, because there is no upload endpoint yet.
- `documents` is **never** returned (`select: false` on the model) and is not writable.
- Same ownership rule as the lead endpoints: **403**, not 404, when an agent asks for a
  colleague's listing. 404 only when the id genuinely doesn't exist.
- Soft-deleted listings **are** returned, so a deleted record can still be reviewed and
  restored.

### `GET /api/admin/reference` — editor vocabulary, in one call

Everything the listing editor's controls need, served from `backend/utils/constants.js`
so the form can never offer a value the schema enums reject.

```json
{
  "success": true,
  "data": {
    "listingTypes": ["sale", "rent"],
    "listingStatuses": ["available", "under_offer", "…"],
    "publicationStates": ["draft", "published"],
    "propertyTypes": ["apartment", "mini_flat", "…"],
    "titleTypes": ["c_of_o", "governors_consent", "…"],
    "rentPeriods": ["per_annum", "per_quarter", "per_month"],
    "chargePeriods": ["per_annum", "per_quarter", "per_month", "one_off"],
    "currencies": ["NGN", "USD"],
    "powerSources": ["grid_band_a", "grid_band_b", "…"],
    "waterSources": ["borehole", "well", "…"],
    "meteringTypes": ["prepaid", "postpaid", "none"],
    "floodRiskLevels": ["none", "low", "moderate", "high"],
    "roadConditions": ["tarred", "graded", "untarred"],
    "landUnits": { "sqm": 1, "plot": 648, "plot_lagos": 464, "acre": 4046.86, "hectare": 10000 },
    "stateRentRules": {
      "Lagos": { "maxAgencyFeePct": 10, "maxAdvanceYears": 1 },
      "default": { "maxAgencyFeePct": 100, "maxAdvanceYears": 10 }
    },
    "locations": [{ "_id": "…", "name": "Akobo", "slug": "akobo-oyo", "state": "Oyo" }],
    "taxonomy": [{ "_id": "…", "key": "swimming_pool", "name": "Swimming pool", "category": "amenity" }],
    "agents": [{ "_id": "…", "name": "Adebayo Akinyemi", "slug": "…", "canPublish": false, "isActive": true }]
  }
}
```

- **`agents` is absent — not null, not empty — for a non-administrator.** An agent
  cannot reassign ownership, so the roster isn't served to them. Code that maps over it
  must default (`reference.agents ?? []`).
- `landUnits` carries the **factors**, not just the names, because the API accepts only
  `landSizeSqm` and the client has to convert. Never hardcode "a plot is 648 sqm" —
  it is 464 in parts of Lagos.
- `stateRentRules` is for a pre-submit warning only. `propertyModel`'s `pre("validate")`
  is the authority, and it is the only place the statutory limits are enforced.
- `locations` and `taxonomy` overlap `/api/filters` on purpose: the public payload is
  shaped for visitors and is free to drop a field no searcher uses, but the editor still
  has to be able to file a listing under it.

### Writing a listing — traps

- **`state` is derived, never sent.** The server reads it from the chosen location.
  Sending it is ignored; the point is that a client can't file a Lagos listing under
  another state and slip past the 10% agency-fee cap.
- **A sale must not carry `rent`, and a rental must carry it.** The model invalidates
  both cases outright.
- `price.onRequest: true` means **omit `price.amount`** — it is a genuine state, not a
  zero.
- A 400 returns `details` keyed by **dotted field path** (`"rent.agencyFeePct":
  "Agency fee cannot exceed 10% in Lagos"`), which maps directly onto react-hook-form
  field names.

---

## Staff management (admin, §7)

**Administrator only** — the whole `/api/admin/staff` router 403s an agent, not just
individual routes.

```jsonc
// GET /api/admin/staff — full roster, active AND inactive (unlike public /api/agents)
{ "staff": [{ "_id", "name", "slug", "email", "phone", "whatsapp", "role", "canPublish",
  "position", "bio", "photo", "areas": [{ "_id", "name", "slug" }], "registrationNumber",
  "isActive", "isPublic" }] }

// GET /api/admin/staff/:id
{ "staffMember": { ...same shape } }

// POST /api/admin/staff
// Body: { name, email, password, role, phone?, whatsapp?, position?, bio?, photo?,
//         areas?, registrationNumber?, canPublish?, isPublic? }
// 201 { "staffMember": { ...same shape, never "password" } }

// PATCH /api/admin/staff/:id
// Body: any create field, plus password? (reset — omit to keep current) and isActive?
// 200 { "staffMember": { ...same shape } }
```

- **No hard delete.** Removing a staff member means `PATCH { isActive: false }` —
  `Property.agent`, `Enquiry.agent`, `Viewing.agent` and `Testimonial.agent` all
  reference the account, so deleting it would orphan that history.
- **An administrator cannot deactivate or demote their own account** — 400, not a
  silent no-op. The only guard against a single-admin agency locking itself out.
- The initial password is administrator-typed (≥8 characters, same rule as
  `change-password`) — there is no email invite or reset-token flow in this project.
- Renaming a staff member re-slugs their public `/team/[slug]` profile URL, same
  behaviour `updateProperty` already has for a retitled listing. Two staff members
  sharing a name get `-2`, `-3`, … appended.
- `staffRoles` (the `administrator`/`agent` enum) is served from `GET /api/admin/reference`
  for the role `<select>` — not mirrored in the frontend.

---

## Blog management (admin, §4.2/§7)

**Administrator only** — the whole `/api/admin/blog` router 403s an agent, same as
staff management, per §7's role table (blog is listed under Administrator, not Agent).

```jsonc
// GET /api/admin/blog — table: drafts + soft-deleted included
// Query: q, publicationState, includeDeleted, page, limit
{ "posts": [{ "_id", "title", "slug", "publicationState", "author": { "_id", "name",
  "slug" } | null, "updatedAt", "publishedAt", "deletedAt" }],
  "pagination": { "page", "limit", "total", "pages" } }

// GET /api/admin/blog/:id — full record, for the editor
{ "post": { ...every field, "author" populated as above } }

// POST /api/admin/blog
// Body: { title, excerpt?, body, coverImage?, author?, categories?, tags?,
//         metaTitle?, metaDescription?, ogImage?, publicationState? }
// 201 { "post": { ...full record, slug auto-generated from title } }

// PATCH /api/admin/blog/:id
// Body: any create field
// 200 { "post": { ...full record } }

// DELETE /api/admin/blog/:id — soft delete; 200 { "data": null }
// POST /api/admin/blog/:id/restore — undo; 200 { "post": { ...full record } }
```

- **Soft delete, not hard** — same reasoning as Property: a post's URL may be linked
  from elsewhere. `DELETE` sets `deletedAt` and forces `publicationState` back to
  `draft`; `restore` only clears `deletedAt`, it does not re-publish.
- **`slug` is always server-generated** from `title`, with a `-2`, `-3`, … suffix on
  collision — never accepted from the request body.
- **`publishedAt` is stamped once**, the first time a post becomes `published` — an
  unrelated edit afterward does not move it, so the blog index doesn't reorder itself
  on a typo fix.
- `author` accepts any active staff `_id` from `GET /api/admin/reference`'s `agents`
  list, or `null`/omitted for no author. There is no ownership scoping — any
  administrator can assign any staff member as author.
- `categories`/`tags` are free-form string arrays, not a taxonomy reference — they
  don't gate any search filter, unlike Property's taxonomy-backed `tags`.
- `locations` exists on the model (cross-linking to a `Location`) but is not
  writable through this API yet — deferred until neighbourhood pages exist to link to.

---

## Lead operations (admin)

The enquiry inbox and the viewing diary. Every route requires a session; none is public.

### Ownership — read this before building the UI

- An **agent sees only leads assigned to them.** An **administrator sees everything.**
- **Unassigned leads are administrator-only.** A contact-page enquiry or a valuation
  request belongs to nobody until an administrator assigns it, so no agent sees it.
- A violation is **403**, not 404 — unlike the public surface, these are authenticated
  colleagues and the clearer error is more useful than hiding existence.
- Ownership is applied **last** when building the list query, so
  `?agent=<colleague id>` can never widen an agent's scope.
- `notes` is `select: false` on both models: **absent from list responses, present on
  detail responses.** Never render it publicly.

### `GET /api/admin/enquiries` — the inbox

Query: `status`, `type`, `source`, `agent`, `property`, `q`, `dateFrom`, `dateTo`,
`sort`, `page`, `limit`.

- `q` searches `name`, `phone` and `email`. Regex metacharacters are escaped, so `.*`
  matches the literal string.
- Enum filters are validated against `constants.js`; an unrecognised value is **ignored**
  rather than rejected, so a stale admin UI never breaks the inbox.
- `sort=oldest` inverts the default newest-first order, for working a backlog.
- `page` defaults 1, `limit` defaults 20 and is capped at 100.

Returns `{ enquiries, pagination }`.

### `GET /api/admin/enquiries/stats`

`{ stats: { new, contacted, viewing_booked, closed, total } }` — every
`ENQUIRY_STATUSES` key is present **even at zero**, so the UI never renders `undefined`.
Scoped to the caller exactly like the list.

> Declared **before** `/:id` in the router. Adding a route after `/:id` makes it
> unreachable — the same gotcha as `/properties/featured`.

### `GET /api/admin/enquiries/:id`

`{ enquiry }` with `property` and `agent` populated, **including `notes`**.

### `PATCH /api/admin/enquiries/:id`

Body is allow-listed to `status`, `notes`, `agent`. Everything else is dropped silently.

- `contactedAt` and `closedAt` are stamped by the model's pre-save hook and are **never
  accepted from the body** — they are the agency's response-time metric, and a writable
  timestamp is a falsifiable one.
- `agent` reassignment is **administrator-only** (403 for an agent). An agent must not be
  able to hand a lead away, nor claim one that was never theirs.
- An invalid `status` is 400.

### `DELETE /api/admin/enquiries/:id` — administrator only

**Hard delete**, not soft. NDPA 2023 erasure means the personal data is actually gone; a
tombstone retaining name, phone and email would not satisfy an erasure request. Returns
204 and writes an audit line to the log.

### `GET /api/admin/viewings` — the diary

Query: `status`, `agent`, `property`, `dateFrom`, `dateTo`, `upcoming`, `page`, `limit`.

Sorted by `requestedFor` **ascending** — a diary reads soonest-first, deliberately unlike
the inbox. `upcoming=true` hides anything already past.

Returns `{ viewings, pagination }`.

### `GET /api/admin/viewings/:id` · `DELETE /api/admin/viewings/:id`

Detail includes `notes`. DELETE is administrator-only and hard, for the same NDPA reason.

### `PATCH /api/admin/viewings/:id`

Body is allow-listed to `status`, `scheduledFor`, `responseMessage`, `notes`.
`respondedAt` is stamped by the model hook.

**Status transitions are enforced server-side:**

```
requested   → accepted | rejected | rescheduled | cancelled
rescheduled → accepted | rejected | cancelled
accepted    → completed | cancelled | rescheduled
rejected · completed · cancelled → terminal
```

- An illegal transition is **400** naming both states. A completed viewing cannot revert.
- Re-applying the current status is a **no-op, not an error** — a double-clicked Accept
  button must not surface a 400.
- `accepted` **inherits `requestedFor`** when the body omits `scheduledFor`. Accepting the
  prospect's own suggested time is the common case; the client need not echo it back.
- `rescheduled` **requires** a `scheduledFor` that is in the future and different from the
  current one. Otherwise 400.

On accept, reject and reschedule the prospect is emailed — **after** the response is sent,
best-effort, never failing the write, and skipped entirely when they gave no email
address.

---

## Listing media (authenticated)

Five endpoints under `/api/admin/properties/:id/media`. All require a session and apply
the same §7 ownership rule as the listing endpoints: an agent reaching a colleague's
listing gets **403, not 404**.

The browser uploads **straight to Cloudinary**, not through this API (scope §10.3 —
agents upload 8MB phone photos over connections that drop). So the flow is three steps,
and the middle one does not touch our server:

```
1. POST .../media/signature   ->  API returns a signature scoped to this listing's folder
2. POST to Cloudinary          ->  browser uploads directly, with progress
3. POST .../media              ->  API verifies the asset with Cloudinary, then stores it
```

### The one rule that matters

**Step 3 believes nothing the client sends except `publicId` and `alt`.** The controller
calls `cloudinary.api.resource(publicId)` and reads `url`, `width`, `height`, `bytes` and
`thumbnailUrl` from *Cloudinary's* response. Sending `url` or `width` in the body is not
an error — they are simply ignored. A client-supplied url would make the record point
anywhere; client-supplied dimensions would poison the layout-space reservation on every
page the image appears on.

The folder check runs **before** the Cloudinary lookup, so the endpoint cannot be used to
probe which public ids exist in the account.

### `POST /api/admin/properties/:id/media/signature`

`strictLimiter` — every call authorises spend. No request body.

```json
{
  "success": true,
  "data": {
    "timestamp": 1788536823,
    "signature": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    "apiKey": "123456789012345",
    "cloudName": "demo-cloud",
    "folder": "properties/REF1001",
    "uploadUrl": "https://api.cloudinary.com/v1_1/demo-cloud/image/upload",
    "allowedFormats": ["jpg", "jpeg", "png", "webp", "avif"],
    "maxFileSize": 15728640,
    "eager": "c_fill,w_400,h_300,q_auto,f_auto"
  }
}
```

**The browser must POST to Cloudinary exactly these fields and no others:** `file`,
`api_key`, `timestamp`, `signature`, `folder`, `allowed_formats`, `eager`. Cloudinary
recomputes the signature over what it receives, so one extra or missing field fails the
upload with "Invalid Signature". Adding a field means changing
[backend/utils/mediaSignature.js](../backend/utils/mediaSignature.js) **and**
[frontend/src/lib/uploadMedia.js](../frontend/src/lib/uploadMedia.js) together.

`maxFileSize` is **advisory** — the browser rejects oversized files early to avoid
spending a rate-limited signature call. It is deliberately *not* signed: Cloudinary's
`max_file_size` needs an authenticated upload preset, and signing an unsupported
parameter fails every upload.

### `POST /api/admin/properties/:id/media`

Body: `{ "publicId": "properties/REF1001/kq3xz9pmv1rd8w", "alt": "Front elevation" }` —
`alt` optional, everything else ignored. Responds **201**.

```json
{
  "success": true,
  "data": {
    "media": {
      "_id": "6a9ae7f7c7b32b2a285722f9",
      "property": "6a9ae7f7c7b32b2a285722f8",
      "url": "https://res.cloudinary.com/demo-cloud/image/upload/v1757001600/properties/REF1001/kq3xz9pmv1rd8w.jpg",
      "publicId": "properties/REF1001/kq3xz9pmv1rd8w",
      "thumbnailUrl": "https://res.cloudinary.com/demo-cloud/image/upload/c_fill,w_400,h_300,q_auto,f_auto/v1757001600/properties/REF1001/kq3xz9pmv1rd8w.jpg",
      "type": "image",
      "alt": "Front elevation from the street",
      "displayOrder": 0,
      "width": 4032,
      "height": 3024,
      "bytes": 2418177,
      "createdAt": "2026-09-04T15:47:03.349Z",
      "updatedAt": "2026-09-04T15:47:03.349Z",
      "__v": 0
    }
  }
}
```

`displayOrder` is computed server-side as `max + 1`, so a new image lands at the end of
the gallery. It is never accepted from the body — a client could otherwise reorder by
uploading.

| Failure | Status |
| ------------------------------------------------- | ------ |
| `publicId` missing or empty                       | 400    |
| `publicId` outside this listing's folder          | 400    |
| Cloudinary has no such asset                      | 404    |
| Cloudinary unreachable (SDK detail never surfaced) | 502    |
| Same `publicId` registered twice (unique index)   | 409    |

### `PATCH /api/admin/properties/:id/media/order`

Body `{ "ids": [...] }`. **Must be a full permutation** of the listing's media — same
length, same set, no duplicates — or 400. A partial list would leave the omitted rows
holding stale `displayOrder` values that collide with the rewritten ones, making gallery
order arbitrary rather than merely wrong.

Responds with the reloaded gallery in its new order, so the client renders the server's
truth rather than its own guess:

```json
{
  "success": true,
  "data": {
    "media": [
      { "_id": "6a9ae7f7c7b32b2a285722fa", "displayOrder": 0, "...": "full media objects" },
      { "_id": "6a9ae7f7c7b32b2a285722f9", "displayOrder": 1, "...": "full media objects" }
    ]
  }
}
```

### `PATCH /api/admin/properties/:id/media/:mediaId`

**Alt text only.** `url`, `publicId`, `displayOrder`, `width` and `height` are all
server-controlled; sending them is ignored, not an error. An empty string is a valid
clear. Responds `{ success: true, data: { media } }` with the full updated record.

An image belonging to another listing is **404** — the lookup is scoped by property, so
a `mediaId` alone is not authorisation.

### `DELETE /api/admin/properties/:id/media/:mediaId`

**Permanent, unlike a listing's soft delete.** The Cloudinary asset is destroyed
(`invalidate: true`, so CDN caches are purged) and the record removed. There is nothing
to restore.

```json
{ "success": true, "data": { "deleted": true } }
```

Two orderings that matter:

- **Cloudinary first, database second.** An orphaned Cloudinary asset bills forever with
  nothing pointing at it; an orphaned database row is visible and fixable. A genuine SDK
  failure returns **502 and keeps the record**.
- `result: "not found"` from Cloudinary is treated as **success**. The asset being
  already gone is the outcome we wanted; failing would make a half-deleted image
  permanently undeletable from the UI.

Deleting the listing's cover image **clears `Property.coverImage`** — a dangling
reference makes `coverImageOf` fall through to the grey placeholder with nothing in the
UI explaining why. The remaining images are *not* renumbered: `displayOrder` stays
strictly increasing, which is all the sort needs, and renumbering would race with a
concurrent reorder.

### When Cloudinary is not configured

Every media endpoint returns **503** with `"Image uploads are not configured"`, and the
API still boots and serves everything else — same tolerance `config/db.js` has for a
missing `MONGODB_URI`. The listing editor shows the message inline; the rest of the form
keeps working.

```json
{ "success": false, "message": "Image uploads are not configured" }
```

---

## Not built yet

No endpoints exist for: pages (site copy) or settings updates. The **models exist**
for both — only the routes and controllers are missing. Don't build admin UI against
these until the endpoints are written.

The §4.3 **daily enquiry digest** is also unbuilt: it needs a scheduler decision
(in-process cron vs. a platform cron hitting a protected route) that is really a
deployment question.

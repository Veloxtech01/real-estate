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
| PATCH/DELETE | `/api/admin/properties/:id` | Update / **soft** delete |
| POST | `/api/admin/properties/:id/restore` | Undo soft delete |
| POST | `/api/admin/properties/:id/feature` | **Administrator only** (403 for agents) |

- `role` is `administrator` | `agent`. Agents see and edit **only their own** listings.
- An agent with `canPublish: false` gets **403** when setting `publicationState:
  "published"` — the admin UI should hide or disable that control for them.
- Login is throttled to 10 failed attempts / 15 min.
- Expect a **401 at any time** (deactivated account, expired token) — handle it in the
  Axios interceptor and redirect to login, not per call site.

Local admin credentials are in `backend/.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

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

## Not built yet

No endpoints exist for: staff management, blog posts, pages, testimonials, settings
updates, or media upload. The **models exist** for all of them — only the routes and
controllers are missing. Don't build admin UI against these until the endpoints are
written.

The §4.3 **daily enquiry digest** is also unbuilt: it needs a scheduler decision
(in-process cron vs. a platform cron hitting a protected route) that is really a
deployment question.

# Admin Panel — Listings Table and Editor (Design)

Date: 2026-09-04
Scope: Sub-project B of the admin panel — the listing table and the listing editor,
plus the two API additions they need. Media upload, staff management, settings admin
and the blog editor are separate specs.

---

## 1. Why this slice

`45e162d` shipped the admin shell, dashboard, enquiry inbox and viewing diary. Every
pattern the editor depends on — session provider, `useAdminResource`, role gating,
`ConfirmDialog`, verbatim API error display — is now proved against four screens.

Listings is the last module of the panel and the only one whose backend is (almost)
already written: `adminPropertyController.js` has list, create, update, soft delete,
restore and feature. The Listings entry in `AdminSidebar` is deliberately disabled;
this slice enables it.

**What this slice does not include:** image upload. Cloudinary is not configured and
needs credentials the repo doesn't have. The consequence is stated in §7.

---

## 2. Decision record

| Decision | Choice | Reason |
| --- | --- | --- |
| Editor layout | **One long sectioned form**, sticky section nav, one Save | The record is ~25 writable fields across nine groups. A wizard suits first creation but is hostile to the far more common job — changing one field on an existing listing — and would need a second edit view. Tabs hide validation errors on unseen panels |
| Editor placement | **Its own route**, not the master-detail pane | Nine sections do not fit a detail column. Enquiries and viewings stay master-detail; this is a different shape of work, not an inconsistency to fix |
| Missing enums | **New `GET /api/admin/reference`** | `constants.js` is the single source of truth for every enum, because the AI-search validator checks against the same lists the DB enforces. Mirroring them into a frontend constants file would let the two drift silently |
| Where those enums live | **Authenticated, not on `/api/filters`** | Listing statuses, publication states, staff and `STATE_RENT_RULES` are operational. The public filter payload should carry what a visitor filters by and nothing else |
| Single-record read | **New `GET /api/admin/properties/:id`** | The editor needs one record with its gallery, not page 3 of a table |
| Media | **Cover picker over existing `PropertyMedia`**, URL inputs for floor plan and OG image | `coverImage` is an ObjectId ref. A pasted-URL cover would need a schema change and would fight the real upload pipeline later |
| Validation authority | **Client mirrors, API decides** | Same one-way rule as `viewingTransitions.js`. Client rules exist for immediate feedback; on any disagreement the API's 400 wins and is shown verbatim |
| Optimistic updates | **None** | Consistent with the lead screens. A listing that appears published but isn't is worse than a short wait |

---

## 3. API additions

### 3.1 `GET /api/admin/properties/:id`

Ownership-checked through the existing `loadManageable` helper, so an agent requesting a
colleague's listing gets **403**, and a missing id gets 404 — matching the lead
endpoints, where a 404-for-403 would be dishonest between authenticated colleagues.

Populates `location` (`name slug state`), `agent` (`name slug`), `tags` (`key name
category`) and `coverImage`, and additionally returns the listing's full
`PropertyMedia` gallery sorted by `displayOrder`, which is what the cover picker
renders.

`documents` is `select: false` on the model and stays unselected. It is not in
`WRITABLE_FIELDS` and this slice does not edit it.

Response: `{ success: true, data: { property, media } }`.

### 3.2 `GET /api/admin/reference`

One authenticated preload call for everything the editor's controls need that
`/api/filters` does not already serve.

Returns `listingStatuses`, `publicationStates`, `chargePeriods`, `powerSources`,
`waterSources`, `meteringTypes`, `floodRiskLevels`, `roadConditions`, `landUnits`
(the `LAND_UNITS_IN_SQM` keys, for the land-size unit converter), `stateRentRules`
(the whole `STATE_RENT_RULES` table plus its default), and `agents`.

`agents` is `_id`, `name`, `slug`, `canPublish`, `isActive` — active agents only. It
exists so an administrator can assign ownership at creation. **Agents do not receive
the list**: the response omits it for a non-administrator caller, because an agent
cannot reassign ownership and the roster is not theirs to enumerate. No email, phone or
password field is ever projected.

Lives in `referenceController.js` beside `getFilterOptions`, with its own
`adminReferenceRoutes.js` mounted at `/api/admin/reference` behind `requireAuth`.

### 3.3 Nothing else changes

`WRITABLE_FIELDS`, the publish gate, the state-from-location derivation, the soft
delete and the administrator-only feature toggle are all already correct. This slice
adds no writable field.

---

## 4. Routes

| Route | Purpose |
| --- | --- |
| `/admin/properties` | The table. `?status=`, `?publicationState=`, `?q=`, `?includeDeleted=`, `?page=` |
| `/admin/properties/new` | Create |
| `/admin/properties/[id]` | Edit |

All three live under `app/admin/(panel)/`, all client components, same as the rest of
the panel. `AdminSidebar`'s Listings entry loses its `disabled` flag and the
"Coming soon" branch it was the only user of.

Filters stay in the URL, matching the inbox and diary. Changing a filter resets to page 1.

---

## 5. The table

Columns: cover thumbnail, reference, title, location, listing type, price or rent,
status, publication state, updated. On a soft-deleted row the whole row is dimmed and
carries a "Deleted" marker — it is only visible at all when `includeDeleted=true`.

Row actions:

| Action | Who | Behaviour |
| --- | --- | --- |
| Edit | Owner or administrator | Navigates to `/admin/properties/[id]` |
| Feature | **Administrator only** | `POST /:id/feature`, then `refetch()`. Hidden for agents — courtesy, not security; the API returns 403 regardless |
| Delete | Owner or administrator | `ConfirmDialog`, then `DELETE /:id`. The dialog says **soft** delete: the listing is unpublished and hidden, enquiries that reference it keep resolving |
| Restore | Owner or administrator | Only on a deleted row. `POST /:id/restore` |

Price display reuses `lib/format.js` and `lib/property.js`. **`price` is truthy even on
rentals** — the trap documented in the API reference — so the column branches on
`listingType`, never on `price`.

Reads go through `useAdminResource`. Mutations call `lib/api/admin.js` directly and then
`refetch()`, as everywhere else in the panel.

---

## 6. The editor

`react-hook-form`, one `<form>`, one Save. A sticky left rail links to the sections; a
sticky footer bar holds Save, the publication control and the record's reference and
state. On `/new` the reference reads "Assigned on save" — it is server-generated.

Sections, in order:

1. **Basics** — title, description, listing type, property type, status, and (administrators only) the owning agent
2. **Location** — area select grouped by state, landmark (required), address, latitude/longitude. The state is displayed, never edited: it is derived server-side from the area, and that derivation is what stops a Lagos listing being filed under another state to dodge the rent cap
3. **Specification** — bedrooms, bathrooms, toilets, boys' quarters, parking, land size, built area, year built. Land size takes a number plus a unit select and converts to square metres before submit, because a "plot" is ~648 sqm generally but ~464 sqm in parts of Lagos
4. **Pricing** — branches on listing type. Sale: amount, currency, negotiable, on-request (which disables the amount input, since it is a genuine state and not a zero). Rent: amount, period, advance years, agency fee %, legal fee %, caution deposit, service charge and its period
5. **Title deed** — type, gazette number, free from government acquisition, survey plan available
6. **Infrastructure** — power and water as multi-selects, metering, flood risk, flood history, road condition, distance to tarred road, gated estate, estate name
7. **Tags** — the taxonomy, grouped by category, as checkboxes
8. **Media** — see §7
9. **SEO** — meta title, meta description, OG image URL, with the generated fallback shown as placeholder text so staff can see what they are overriding

Conditional rendering: rent terms only when `listingType === "rent"` and the sale price
block only when it is `"sale"`, watched through `useWatch`; gazette number only when
the title type is `excision` or `gazette`; estate name only when gated estate is on.

**Publishing.** The footer control offers Draft and Published. For an agent without
`canPublish` the Published option is disabled with a note that an administrator
publishes their listings — the same courtesy-not-security rule as Feature.

**Submit.** The form assembles the nested shape the API expects (`price`, `rent`,
`landTitle`, `infrastructure`, `coordinates` as a GeoJSON Point) and omits `rent`
entirely on a sale, because the model rejects rent terms on a sale listing. `state` is
never sent. Create posts, then routes to the new id; update patches in place.

---

## 7. Media without an upload pipeline

The section renders the gallery returned by §3.1 as a grid; clicking an image sets
`coverImage`. Floor plan and OG image are plain URL inputs, which is what those fields
are on the model.

With no Cloudinary credentials there is no Add button. The empty state — which is what
every newly created listing sees — says photos arrive with the media slice and links
nowhere. The 200 demo listings have 600 media rows between them, so the picker is
exercised by real data from day one.

This is a deliberate, stated gap, not an oversight: a listing created through this
editor is complete except for photographs.

---

## 8. Validation

Two layers, and only the second is authoritative.

**Client (`react-hook-form` rules).** Required: title, listing type, property type,
location, landmark. Sale price required unless on-request. Rent amount required on a
rental. Gazette number required for excision or gazette title. Agency fee and advance
years checked against `stateRentRules` for the selected area's state, so a Lagos
listing warns at 11% before the round trip.

**Server.** `propertyModel`'s `pre("validate")` is the authority on every one of those
rules and is the only place the statutory rent limits are actually enforced.

A 400 carries `details` keyed by field path. A `mapApiErrors` helper walks `details` and
calls `setError` for each path that matches a registered field — `rent.agencyFeePct`
lands on that input — and anything unmatched is shown verbatim in a form-level banner,
so a server rule the client doesn't know about is never swallowed. A 403 (publish
without permission, or another agent's listing) shows the API's message verbatim.

---

## 9. New files

```
backend/routes/adminReferenceRoutes.js
backend/tests/adminReference.test.js
backend/tests/adminPropertyDetail.test.js

frontend/src/app/admin/(panel)/properties/page.js
frontend/src/app/admin/(panel)/properties/new/page.js
frontend/src/app/admin/(panel)/properties/[id]/page.js
frontend/src/components/admin/PropertyTable.jsx
frontend/src/components/admin/PropertyForm.jsx
frontend/src/components/admin/property/*.jsx        one component per section
frontend/src/components/admin/CoverImagePicker.jsx
frontend/src/lib/propertyForm.js                    form <-> API shape, land conversion
frontend/src/lib/apiErrors.js                       details -> setError
```

`PropertyForm.jsx` owns the form instance, submit and error mapping only; each section
is its own component taking `register`/`control`. A single file holding nine sections
would be unreviewable and unreliable to edit.

Modified: `adminPropertyController.js`, `referenceController.js`, `app.js`,
`lib/api/admin.js`, `AdminSidebar.jsx`.

---

## 10. Testing

**Backend** (`vitest` + `supertest` + `mongodb-memory-server`, matching the existing
suites):

- `GET /:id` returns the record with its gallery; 404 for a missing id; **403** when an
  agent requests a colleague's listing
- `GET /admin/reference` requires a session; includes `agents` for an administrator and
  omits it for an agent; never projects a staff email or password field
- Regression: creating with `publicationState: "published"` as an agent without
  `canPublish` still 403s

**Frontend** (`vitest` + Testing Library — no Next compiler, so these are component
tests):

- Rent terms render only for a rental, sale price only for a sale
- Gazette number appears when the title type is excision
- `mapApiErrors` puts a `rent.agencyFeePct` detail on that field and an unmatched path
  in the banner
- Publish is disabled for an agent without `canPublish`; Feature and Delete do not
  render for an agent on the table
- `propertyForm.js`: land unit conversion, `rent` omitted on a sale, `state` never sent

---

## 11. Docs to update as part of the change

- `docs/API-REFERENCE.md` — the two new endpoints, with shapes captured from the running
  API, and both removed from its "Not built yet" list
- `CLAUDE.md` — the endpoint table, the Status block (listings management moves out of
  "Not built"), and the admin conventions section for the validation-authority rule
- This spec, if the implementation departs from it

# Public testimonials endpoint + real homepage wiring

**Date:** 2026-09-05
**Status:** Approved, not yet implemented

Closes the gap `Testimonials.jsx`'s own comment already names: `testimonialModel` exists
with no public route, so the homepage renders fabricated placeholder quotes from
`content/home.js` instead of real ones.

---

## Scope

Backend `GET /api/testimonials`, homepage wiring, and deleting the placeholder content.
No admin UI and no standalone `/testimonials` page — both are deliberately out of scope
for this slice (see Deferred).

---

## Why no seeded demo testimonials

Unlike a demo property listing or a stock photo, a testimonial is a first-person claim —
"this named person said this positive thing about us." Inventing one, even clearly for
dev purposes, recreates exactly the misrepresentation problem this slice exists to fix;
it just moves the fabrication into the database instead of a content file. So:

- No `TESTIMONIAL_SEED` is added to `seedData.js`.
- The public endpoint legitimately returns `[]` until real testimonials exist.
- `Testimonials.jsx` already omits the section entirely when `items` is empty (existing
  behavior, unchanged) — an absent section, not an empty grid or invented content.
- A real testimonial is added the same way `pageModel` content is today: a direct
  database write, until a content-admin editor exists to do it through the UI. This is a
  deliberate, discussed deviation from where curation "should" eventually live, on the
  same terms as the marketing-pages slice's content-source decision.

---

## Backend — public testimonials API (new)

`testimonialModel` already has everything needed (`clientName`, `clientTitle`, `quote`,
`photo`, `rating`, `isPublished`, `displayOrder`) but no route touches it.

**`backend/controllers/testimonialController.js`**

| Function | Behaviour |
| --- | --- |
| `listTestimonials` | `Testimonial.find({ isPublished: true })`, sorted by `displayOrder`, optionally capped by `?limit=`. Projected to a public field whitelist: `clientName, clientTitle, quote, photo, rating`. Never `isPublished`, `displayOrder`, `agent`, or `property` — none of those are consumed by anything public today. |

**`backend/routes/testimonialRoutes.js`** — `GET /`, mounted at `/api/testimonials` in
`app.js`, alongside the other public reference routes. A dedicated controller/route pair
rather than folding into `referenceController.js` — the same structural choice already
made for the agents API, and testimonials is its own resource with its own future shape
(a per-agent or per-property filter is a plausible later addition).

No new enum or whitelist is introduced, so `constants.js` is untouched.

---

## Frontend

**`lib/api/server.js`** gains `getTestimonials(limit)`, mirroring `getFeatured(limit)`:
`revalidate: 300` (testimonials change about as often as featured listings do), tag
`"testimonials"`.

**`content/home.js`**: the `testimonials` block shrinks to `{ eyebrow, title }` — the
`items` array and the `⚠️ PLACEHOLDER COPY` warning comment are deleted outright, not
just muted. The warning is resolved, so leaving it in place would itself become stale
documentation.

**`Testimonials.jsx`** changes signature from reading `homeContent.testimonials`
internally to:

```jsx
export default function Testimonials({ eyebrow, title, items = [] }) {
```

Field access moves from the placeholder's invented `item.name`/`item.role` to the
model's real `item.clientName`/`item.clientTitle`. The existing empty-state behavior
(`if (items.length === 0) return null`) is unchanged — it was already written for this
exact real-API future, per the component's own comment. The list key also moves from
`item.quote` to `item._id` — the placeholder had no real id to key on, but real
testimonials do, and a real database id is a more stable key than quote text.

**Homepage (`(site)/page.js`)** fetches `getTestimonials(6)` in the same `Promise.all` as
`getFeatured`/`getLocations`/`getFilters`, and passes `eyebrow`/`title` (from
`homeContent.testimonials`) plus `items` (from the API) into `<Testimonials />`.

---

## Testing

**Backend** (`backend/tests/api.testimonial.test.js`, supertest + mongodb-memory-server,
mirroring `api.agent.test.js`):

- returns only `isPublished: true` testimonials, ordered by `displayOrder`
- `?limit=` caps the result count
- an unpublished testimonial never appears regardless of `displayOrder`

**Frontend** (`frontend/src/components/home/Testimonials.test.jsx`, new file):

- renders a card per item, mapping `clientName`/`clientTitle` into the visible name/role
- renders nothing (`null`) when `items` is empty
- renders nothing when `items` is omitted entirely (the default `[]`)

---

## Documentation

- `docs/API-REFERENCE.md` — new `GET /api/testimonials` section (shape captured from the
  running API); remove "testimonials" from the "Not built yet" list.
- `CLAUDE.md` — Status block bullet noting the endpoint and that the homepage now reads
  real data; public endpoint table gains the new row.

---

## Deferred (explicitly out of scope this slice)

- Admin CRUD for testimonials (create/edit/publish/reorder) — the separate "Settings
  admin" work item covers this class of gap.
- A standalone `/testimonials` page — §3 lists testimonials as agency-curated content,
  not as a page of its own in this pass.
- Rendering `rating` as stars on the card.
- Cross-linking a testimonial to the agent or property it references (`agent`/`property`
  fields exist on the model but nothing reads them publicly).

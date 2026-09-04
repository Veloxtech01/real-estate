# Marketing pages: Services, About, Team, Contact

**Date:** 2026-09-04
**Status:** Approved, not yet implemented

Closes the biggest gap in the public site (§3): five routes the site currently has no
answer for at all — `/about`, `/services`, `/team`, `/team/[slug]`, `/contact`.

---

## Content-source decision

Two kinds of data are involved, and they are deliberately handled differently:

- **Marketing copy** (about-us story, service descriptions, contact-page intro) is
  **hardcoded in content files**, matching the established pattern in `content/home.js`
  rather than the `pageModel`/DB route. `pageModel` exists and is seeded, but nothing
  reads it today, there is no admin editor to change it, and building the read API + a
  generic section renderer is out of scope for this slice. This is a deliberate,
  discussed deviation from §9's "content in the DB" preference, on the same terms as
  `home.js`: it is placeholder copy the client replaces before launch, same as the demo
  photography.
- **Team roster** is real structured business data that already lives in `agentModel`
  (8 seeded demo agents with `slug`/`bio`/`photo`/`isPublic`). This is fetched from a new
  public API, not hardcoded — inventing a separate placeholder roster would drift from
  the seeded data immediately and gives up the §3 per-agent referral landing page for
  nothing.
- **Contact details** (phone, address, hours, WhatsApp) continue to come from
  `config/site.js`, which is already the established source for these — `lib/api/server.js`
  documents this as a deliberate choice, not an oversight. `getSettings()` already exposes
  all of this from the DB but is deliberately unused for chrome in this build. LASRERA
  number and other registration numbers are added to `site.js` alongside the existing
  contact fields, for the same reason.

**Services scope is narrowed to one hub page.** §3 asks for six separate service pages
(sales, lettings, property management, facility management, valuation, land banking) as
individual SEO entry points. Building six pages of invented placeholder copy is worse
than one honest hub page; individual `/services/[slug]` pages are a follow-up once there
is real copy to put on them.

---

## Backend — public Agents API (new)

`agentModel` already models everything needed (name, slug, photo, position, bio, phone,
whatsapp, areas, registrationNumber, isPublic, isActive) but has no public read path —
only admin routes touch it today.

**`backend/controllers/agentController.js`**

| Function         | Behaviour                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `listAgents`      | `Agent.find({ isPublic: true, isActive: true })`, populated `areas`, projected to public fields only (no email, no password hash — already excluded by `select:false` and the `toJSON` transform, but the query also excludes `email` explicitly since a staff login address is not public data). |
| `getAgentBySlug`  | Same projection, single record. A private or inactive agent, or a slug that never existed, both **404 identically** — matching the existing "don't leak that a record exists" rule used for draft/deleted properties. |

**`backend/routes/agentRoutes.js`** — `GET /`, `GET /:slug`, mounted at `/api/agents` in
`app.js` alongside the other public reference routes (`/api/locations`, `/api/taxonomy`).

No new enum/whitelist is introduced, so `constants.js` is untouched.

---

## Frontend data layer

`lib/api/server.js` gains:

- `getAgents()` — `revalidate: 3600` (a team roster changes rarely), tag `"agents"`.
- `getAgent(slug)` — `revalidate: 3600`, tags `["agents", "agent:<slug>"]`. Returns `null`
  on 404 like `getProperty`/`getLocation`, so the page calls `notFound()`.

---

## Content files (new)

- **`content/about.js`** — heading/intro copy, a short "what we do" blurb, and a
  placeholder history/credentials paragraph, flagged as placeholder like `home.js`.
- **`content/services.js`** — an array of six `{ slug, title, blurb, icon, href }`
  entries for the hub page's section grid. `href` routes to a pre-filtered search where
  one exists (sales → `/properties?listingType=sale`, lettings → `/properties?listingType=rent`)
  and to `/contact` for the other four, which have no natural listing filter.
- **`content/contact.js`** — page heading/intro text only. No contact details live here.

**`config/site.js`** gains `lasreraNumber`, `registrationNumbers` (mirroring
`settingsModel`'s shape so a future switch to the DB source is a data-shape no-op), and
`officeCoordinates: { lat, lng }` for the map pin. All are neutral placeholder values,
consistent with the rest of the file.

---

## Components

- **`EnquiryForm`** generalized in place (no new component): accepts optional `property`
  (currently required in all but name), plus `type`, `source`, `heading`, and
  `messagePlaceholder`, defaulting to today's values (`"property_enquiry"`,
  `"property_page"`, the existing heading/message) so the property-detail call site is
  unchanged. The `property` field in the submitted payload is only included when a
  `property` prop is passed. Contact page passes `type: "general"`,
  `source: "contact_page"`.
- **`TeamCard`** (new, `components/team/TeamCard.jsx`) — photo/name/position, call and
  WhatsApp buttons, links to `/team/[slug]`. Deliberately not a reuse of `AgentCard`:
  `AgentCard` requires a `property` prop for its WhatsApp pre-fill message and reference
  line, which doesn't exist on the team page.
- **Contact page** calls `MapCanvas` directly (not through `PropertyMap`, which expects a
  GeoJSON `coordinates` shape read from a listing) with `config/site.js`'s
  `officeCoordinates`.

---

## Pages (`frontend/src/app/(site)/`)

All Server Components, SSR, alternating `tone` per the established section rhythm.

| Route              | Data                                    | Notes                                                                 |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------- |
| `/about`            | `content/about.js`, `siteConfig`         | LASRERA + registration numbers rendered as trust signals.             |
| `/services`         | `content/services.js`                    | One hub page, section-per-service grid.                                |
| `/team`             | `getAgents()`                            | Grid of `TeamCard`. Empty state if no public agents (shouldn't happen with seed data, but the render must not break). |
| `/team/[slug]`      | `getAgent(slug)`                         | `notFound()` on null. Doubles as the §3 referral landing page. Call/WhatsApp buttons only (same pattern as `AgentCard`) — no enquiry form, see Deferred. |
| `/contact`          | `content/contact.js`, `siteConfig`       | Office details, `EnquiryForm`, `MapCanvas`.                            |

---

## Nav / footer wiring

- `siteConfig.nav` gains About, Services, Team, Contact — picked up automatically by
  `Header` and `MobileNav`, which already render `nav` generically.
- `siteConfig.footerLinks` gains a `"Company"` column (About, Services, Team, Contact) —
  same generic rendering in `Footer`.

No component changes needed for either — both are already fully config-driven.

---

## Testing

**Backend** (`backend/tests/api.agent.test.js`, supertest + mongodb-memory-server,
mirroring `api.property.test.js`):

- list returns only `isPublic && isActive` agents, and never an `email` field
- detail by slug returns one agent with the same projection
- a private, inactive, or nonexistent slug all 404 identically

**Frontend**:

- `TeamCard` renders required fields and the call/WhatsApp links
- `/team/[slug]` calls `notFound()` when `getAgent` resolves null
- `EnquiryForm` submits the property payload unchanged when `property` is passed, and
  omits the `property` field plus uses the passed `type`/`source` when it is not
- existing `EnquiryForm.test.jsx` continues to pass unmodified against the new default
  props

---

## Documentation

- `docs/API-REFERENCE.md` — the two new `/api/agents` endpoints with response shapes
  captured from the running API, and "public agents endpoint" removed from the "not
  built" framing wherever it's implied.
- `CLAUDE.md` — Status block updated (marketing pages no longer listed under "Not
  built"), the public endpoint table gains `/api/agents`, and a note added to the public
  site conventions section about the hardcoded-content decision and its rationale, so a
  future session doesn't "fix" it back toward `pageModel` without reading why.
- `frontend/public/CREDITS.md` — no change; no new imagery introduced by this slice
  (agent `photo` uses existing seeded values or a neutral fallback icon, same as
  `AgentCard`'s existing `agent?.photo` handling).

---

## Deferred (explicitly out of scope this slice)

- **A contact form on the agent profile page, using `source: "agent_page"`.**
  `ENQUIRY_SOURCES` already anticipates this value, but `createEnquiry` always derives
  `agent` from the resolved property (`property?.agent`) and has no path to accept an
  agent id directly for a property-less enquiry — accepting one would need a validated
  (`isActive && isPublic`) `agent` field on the public endpoint, which is a backend
  change beyond this slice's scope. `agent_page` stays unused today the same way it was
  before this slice; `/team/[slug]` gets call/WhatsApp buttons only, not a form.
- Individual `/services/[slug]` pages for each of the six services.
- `pageModel`-backed content and any admin content editor.
- "List your property with us" landing page (`siteConfig.listPropertyHref` keeps pointing
  at WhatsApp).
- Neighbourhood/area landing pages.
- Fetching contact details from `/api/settings` instead of `config/site.js`.

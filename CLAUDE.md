# CLAUDE.md

Project-specific instructions for Claude Code. Read this before making changes.

---

## Project overview

**Real estate agency website** — a marketing + listings site for a single Nigerian
real estate agency (not a marketplace; no third-party agents or platform revenue).
Commercial purpose is **lead generation**: a prospect finds a property via on-site
search or Google, then contacts the agency.

**Project docs:**

- [docs/PROJECT-SCOPE.md](docs/PROJECT-SCOPE.md) — full product scope. Read before
  working on any feature area.
- [docs/API-REFERENCE.md](docs/API-REFERENCE.md) — built endpoints' real response
  shapes and frontend gotchas. Read before writing any code that calls the API.

### Keeping the docs current — required, not optional

**A stale doc is worse than no doc**, because the next session has no way to know it's
wrong and will trust it. These files are the only memory across sessions, so updating
them is part of finishing a change, not a follow-up task.

| When you…                                                             | Update                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Add/change/remove an endpoint, or change a response shape             | [docs/API-REFERENCE.md](docs/API-REFERENCE.md) — **and its "Not built yet" list**                |
| Finish or start a build phase (models, routes, a page, admin section) | The **Status** block below                                                                       |
| Discover an invariant, gotcha or non-obvious constraint               | The relevant conventions section below — write down the _why_                                    |
| Deviate from the scope doc                                            | A note in [docs/PROJECT-SCOPE.md](docs/PROJECT-SCOPE.md) at that section, saying it's deliberate |
| Add an env var                                                        | `backend/.env.example` (and `.env` locally)                                                      |
| Add a dependency                                                      | Flag it to the user first, then the stack table below                                            |
| Change tooling, versions, or a command                                | The stack table and **Commands** below                                                           |

Two rules that keep this honest:

1. **Response shapes get captured from a running API, never written from memory.** The
   `price`-is-truthy-on-rentals trap in the API reference was only found by inspecting
   real responses — it is invisible in the schema.
2. **Say what is _not_ built as carefully as what is.** Most of the wasted effort a
   fresh session can incur comes from assuming an endpoint exists because a model does.

Scope highlights:

- Public marketing site (homepage, services, about, team, testimonials, contact,
  neighbourhood pages, "list your property with us", blog) plus a property search/detail
  experience and an admin panel (listings, enquiries, viewings, staff, blog, settings).
- One AI feature: **natural-language property search** — an LLM only extracts
  structured filters from a free-text query (never generates listing content); filters
  are validated against whitelists and run as an ordinary DB query. See
  [docs/PROJECT-SCOPE.md §5](docs/PROJECT-SCOPE.md#5-ai-natural-language-search).
- Nigerian-market-specific data model needs (rent structure incl. per-annum norm,
  enumerated title/land types, infrastructure fields, naira price formatting) — see
  [docs/PROJECT-SCOPE.md §8](docs/PROJECT-SCOPE.md#8-data-model).
- Must work as a **reusable template** for future agency clients: the repo gets copied
  and rebranded per client, and each copy is then fully independent (clean break, no
  shared runtime, no canonical upstream, no multi-tenant content fetching). Practically
  this means one theme-config source, no hardcoded brand values in components, content
  in the DB rather than in code, and cleanly separable feature modules — see
  [docs/PROJECT-SCOPE.md §9](docs/PROJECT-SCOPE.md#9-building-it-as-a-reusable-template).
- `nigerian_real_estate_dummy_data_200.json` at the repo root is sample listing data —
  useful for seeding/dev fixtures once the backend exists.

Two-package repo, MERN-family stack:

```
/frontend   Next.js (React 19) client — SSR on listing/search pages
/backend    Express 5 + Node API, Mongoose models (MongoDB)
/docs       Reference docs (PROJECT-SCOPE.md = scope, API-REFERENCE.md = endpoints)
```

> **Status: public site, lead operations, listings management and media upload complete
> end to end. Content admin is the open gap.** Read the "Not built" entry below
> before assuming any feature area exists.
>
> - `/frontend` — `create-next-app` scaffold: **Next.js 16.3.4 + React 19.2.8**, App
>   Router, `src/` dir, `@/*` import alias, Tailwind v4 via `@tailwindcss/postcss`.
>   Dependencies installed (axios, react-hook-form, react-icons, react-tooltip,
>   react-hot-toast, motion; dev: oxlint, vitest, jsdom, Testing Library,
>   `@vitejs/plugin-react`, `@testing-library/user-event`; plus `leaflet` +
>   `react-leaflet` for the property map). Test harness wired up
>   ([frontend/vitest.config.mjs](frontend/vitest.config.mjs) +
>   [frontend/vitest.setup.js](frontend/vitest.setup.js)).
>   Public site and admin panel both built — see the status list below.
> - `/backend` — Express app with the public API, staff auth, admin listing CRUD,
>   lead operations and AI search:
>   [index.js](backend/index.js) (boot + graceful shutdown),
>   [app.js](backend/app.js) (`createApp()`, CORS, parsers, `/api` rate limit),
>   [config/db.js](backend/config/db.js), [utils/logger.js](backend/utils/logger.js),
>   [utils/ApiError.js](backend/utils/ApiError.js),
>   [middleware/errorHandler.js](backend/middleware/errorHandler.js),
>   [middleware/rateLimiter.js](backend/middleware/rateLimiter.js),
>   [middleware/auth.js](backend/middleware/auth.js) (session + ownership scoping),
>   and routes/controllers per resource. See the endpoint tables below.
> - **Data model — all Phase 1 collections written** ([backend/model/](backend/model/)):
>   `propertyModel`, `propertyMediaModel`, `agentModel`, `locationModel`,
>   `locationAliasModel`, `taxonomyModel`, `enquiryModel`, `viewingModel`,
>   `blogPostModel`, `pageModel`, `testimonialModel`, `searchLogModel`,
>   `settingsModel` — domain enums/whitelists in
>   [backend/utils/constants.js](backend/utils/constants.js). Phase 2 collections
>   (users, favorites, saved_searches, notifications) are **not** written. `emails/`
>   is empty. 46/46 tests pass.
> - **Seed script written** ([backend/scripts/](backend/scripts/)): `seed.js` (CLI +
>   exported seeders), `seedData.js` (baseline taxonomy/locations/aliases/pages/
>   settings), `importDemoListings.js` (maps the root
>   `nigerian_real_estate_dummy_data_200.json` → 200 properties + 600 media, illustrated
>   from the committed Pexels catalogue in `scripts/demoImages.js`). Seeding
>   is idempotent and never overwrites client-edited page copy. Tested against
>   mongodb-memory-server and run against the live `realestate_dev` cluster.
> - **Public API built** — property search/detail/featured, locations, taxonomy,
>   filter options, public settings, plus enquiry and viewing submission.
> - **Staff auth + admin listing CRUD built** — cookie JWT login, `/api/auth/*`, and
>   `/api/admin/properties` with §7 ownership rules.
> - **AI natural-language search built** (`POST /api/search`) — deterministic
>   Nigerian phrase parser, parse cache, Claude fallback, spend cap + kill switch.
>   **AI is disabled by default** and works without it.
> - **Lead operations built** — `/api/admin/enquiries` (inbox, stats, status, notes,
>   assignment) and `/api/admin/viewings` (diary, accept/reject/reschedule) with §7
>   ownership scoping, a server-enforced viewing status transition whitelist, and
>   NDPA hard deletion restricted to administrators.
> - **Frontend public site built** — theme tokens + `config/site.js` rebrand seam,
>   header/footer, homepage, `/properties` search (SSR, URL-as-state), and
>   `/property/[slug]` detail with gallery, Leaflet map, enquiry form, JSON-LD,
>   sitemap and robots.
> - **Public site restyled to the navy/gold/ivory direction** — alternating light and
>   dark section grounds, a scrimmed hero with a structured search panel, a stats band
>   and a testimonials rail on the homepage, and navy header/footer site-wide. The stats
>   and testimonial copy are **placeholders in `src/content/home.js`** and must be
>   replaced or removed before a client launch.
> - **Admin panel shell + lead screens built** — `/admin/login`, the authenticated
>   shell, a dashboard, and master-detail enquiry inbox and viewing diary at
>   `/admin/enquiries` and `/admin/viewings`.
> - **Admin listings management built** — the table at `/admin/properties` (drafts,
>   soft-deleted rows, feature toggle, delete/restore) and the nine-section editor at
>   `/admin/properties/new` and `/admin/properties/[id]`, backed by two new endpoints:
>   `GET /api/admin/properties/:id` and `GET /api/admin/reference`.
> - **Media upload built** — signed direct-to-Cloudinary uploads under
>   `/api/admin/properties/:id/media`, and a gallery manager in the listing editor with
>   drag *and* keyboard reordering, per-image alt text, cover selection and permanent
>   delete. Needs `CLOUDINARY_*` in `.env`; without them the endpoints 503 and the rest
>   of the admin keeps working.
> - **Demo listings carry real photography** from Pexels, hotlinked from
>   `images.pexels.com`. The catalogue is committed at
>   [backend/scripts/demoImages.js](backend/scripts/demoImages.js) and refreshed by hand
>   with `node scripts/fetchDemoImages.js` (needs `PEXELS_API_KEY`). **Replace with the
>   agency's own photography before a client launch** — see `frontend/public/CREDITS.md`.
> - **Marketing pages built** — `/about`, `/services`, `/team`, `/team/[slug]`,
>   `/contact` and `/list-your-property`, closing the §3 gap. About/Services/Contact/
>   List-your-property copy is hardcoded in `src/content/`, matching `home.js`; Team is
>   backed by a new public `GET /api/agents` · `GET /api/agents/:slug` (public + active
>   profiles only). See the conventions note below before "fixing" this back toward
>   `pageModel`.
> - **"List your property with us" built** — a frontend-only slice: no backend change,
>   since `type: "list_property"`/`source: "list_property_page"` were already in
>   `ENQUIRY_TYPES`/`ENQUIRY_SOURCES` with no writer. `ListPropertyForm` posts through
>   the same `POST /api/enquiries` every other lead form uses, with structured details
>   (listing intent, property type, location, bedrooms, expected price/rent) packed
>   into `requirement` — the first real caller of that field. `location` is free text,
>   not the locations dropdown, deliberately: a seller's property may be outside current
>   coverage, which is exactly the lead worth capturing. `siteConfig.listPropertyHref`
>   now points here instead of a WhatsApp deep link.
> - **Homepage testimonials built** — `GET /api/testimonials` (published, curator-ordered,
>   `?limit=`) replaces the fabricated placeholder quotes that used to live in
>   `content/home.js`. No demo testimonials are seeded — see the design spec for why —
>   so the rail renders nothing on a fresh copy until real ones are curated by a direct
>   database write.
> - **Staff management built** — `/admin/staff` (administrator only): create, edit,
>   deactivate/reactivate and assign roles for `agentModel` accounts. Deactivate-only,
>   never a hard delete — `Property`/`Enquiry`/`Viewing`/`Testimonial` all reference an
>   agent by id. An administrator cannot deactivate or demote their own account. The
>   initial password is administrator-typed; there is no email invite/reset flow.
> - **Blog built** — admin editor at `/admin/blog` (administrator only: create, edit,
>   publish, soft-delete/restore `blogPostModel` records) plus the public `/blog` and
>   `/blog/[slug]` pages. `GET /api/blog` · `GET /api/blog/:slug` (published-only,
>   404 parity with drafts/deleted, same as properties/agents) and
>   `/api/admin/blog/*` (§7 administrator-only, no ownership scoping). Post bodies
>   are Markdown, rendered on the frontend with **`react-markdown`** (new
>   dependency — never raw HTML). `locations` cross-linking and category/tag archive
>   pages are deferred — see the design spec.
> - **Settings admin built** — `/admin/settings` (administrator only), one form over
>   the `settingsModel` singleton: agency identity, contact/social/office hours,
>   branding (9 core color tokens + font/logo fields), AI search kill switch/spend
>   cap/timeout, compliance and analytics ids. `GET/PATCH /api/admin/settings`
>   deep-merges `theme`/`aiSearch` so a partial update never clobbers the rest;
>   `aiSearch.currentSpendUsd` is always read-only. Saving a theme color busts the
>   public settings cache (`POST /api/revalidate`) and `RootLayout` injects it live as
>   an inline `<style>` override — site-wide, admin chrome included. **Logo/favicon and
>   font (`fontHeading`/`fontBody`) fields are stored but inert** — they need a separate
>   asset/font-loading change before they render anywhere; the form captions this.
> - **Neighbourhood pages built** — `/areas` (index, grouped by state) and
>   `/areas/[slug]` (copy + a live grid of that area's listings via
>   `GET /api/properties?location=slug`), closing the §4.1 gap. `GET
>   /api/locations/:slug` now 404s an unpublished area exactly like a nonexistent one —
>   it didn't before, unlike every other public resource; fixed alongside this slice.
>   Four locations ship published with real copy (Lekki Phase 1, Ikoyi, Victoria
>   Island, Maitama); everything else stays unpublished until a client supplies area
>   copy, same status Testimonials had pre-curation. The homepage's "Browse by area"
>   tiles link to `/areas/[slug]` for a published area and fall back to
>   `/properties?location=slug` otherwise. **Header nav dropped About/Team/Contact**
>   (footer's Company column already carries them) to make room without crowding;
>   footer's Explore column gained "Areas we cover".
> - **§4.3 daily digest built** — an in-process `node-cron` job (`backend/index.js`)
>   fires `sendDailyDigest()` (`backend/utils/dailyDigest.js`) at 7:00 AM
>   `Africa/Lagos` daily. It emails every active `role: "administrator"` account a
>   compact list of enquiries created in the last 24h (name, type, property/area,
>   submitted time, a link into `/admin/enquiries?id=`), reusing `sendEmail` from
>   `emailService.js` — best-effort, never throws. Sends nothing on a day with zero
>   new enquiries (no "quiet day" heartbeat). Viewings aren't included — they already
>   have their own immediate notifications. This was the last open item in this list.
> - 308/308 backend tests and 188/188 frontend tests pass; both packages lint clean.
>
> Build only what has been asked for — check the "Not built" list above before
> assuming a feature area is in scope.

> ⚠️ **Next.js 16 is newer than most training data.** `frontend/AGENTS.md` (auto-generated
> and re-added by `next dev`) warns that APIs, conventions, and file structure may differ
> from what you remember. **Read the relevant guide in `frontend/node_modules/next/dist/docs/`
> before writing any Next.js code** — don't rely on recalled Next 13/14/15 patterns.
> `frontend/CLAUDE.md` exists solely to import that file; leave both in place.

> **Note:** the nested `frontend/.git` that `create-next-app` created has been removed.
> The project root is the single git repo, and work happens directly on `main`.

### Stack decision: Next.js + MongoDB (deviates from the scope doc's own recommendation)

[docs/PROJECT-SCOPE.md §10.1](docs/PROJECT-SCOPE.md#10-technical-recommendations-source-doc)
recommends Next.js **and** PostgreSQL/PostGIS. This project deliberately keeps
**MongoDB/Mongoose** instead (consistency with other MERN projects) while still adopting
**Next.js for SSR** — the scope doc is explicit that organic search is the primary
acquisition channel and a client-rendered SPA undermines it, which is why the frontend
moved off a Vite SPA. Where §10 of the scope doc and this file disagree on stack, **this
file wins**; the scope doc's product requirements otherwise still apply.

---

## Tech stack (frontend — intended)

| Concern   | Library                                  | Notes that matter                                                                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | `next` 16.3.4 (App Router)               | **SSR/SSG required on listing & search pages** — a product requirement (SEO/lead-gen), not a preference. **Next 16 ≠ your training data — read `frontend/node_modules/next/dist/docs/` first** (see warning above)                                                                                  |
| Lint      | `oxlint` 1                               | Carried over from prior scaffold convention — no config file yet; confirm it covers Next.js file conventions (route handlers, `app/` dir) before relying on it                                                                                                                                      |
| UI        | `react` / `react-dom` 19.2               | New JSX transform — no `import React` needed for JSX                                                                                                                                                                                                                                                |
| Styling   | `tailwindcss` 4 + `@tailwindcss/postcss` | **v4 — CSS-first config, NOT v3.** Wired via `frontend/postcss.config.mjs` (not Vite's `@tailwindcss/vite`). Theme customization goes in CSS via `@theme` in `frontend/src/app/globals.css`; no `tailwind.config.js`                                                                                |
| Routing   | Next.js file-based routing (`src/app/`)  | Replaces `react-router-dom` — don't reintroduce React Router. Import alias is `@/*` → `src/*` (`frontend/jsconfig.json`)                                                                                                                                                                            |
| HTTP      | `axios` 1                                | Use one shared instance (see below)                                                                                                                                                                                                                                                                 |
| Forms     | `react-hook-form` 7                      | Uncontrolled-first; prefer over manual `useState` forms                                                                                                                                                                                                                                             |
| Icons     | `react-icons` 5                          | Import per-icon from the specific set                                                                                                                                                                                                                                                               |
| Tooltips  | `react-tooltip` 6                        | Confirm current API (`data-tooltip-id` etc.) against installed version before first use                                                                                                                                                                                                             |
| Toasts    | `react-hot-toast` (preferred)            | Use `react-hot-toast` for toasts; do not add `react-toastify`                                                                                                                                                                                                                                       |
| Animation | `motion` (Framer Motion)                 | **Default animation library** — use for all animations                                                                                                                                                                                                                                              |
| Charts    | `recharts` 3                             | Default chart library — add when a chart is actually needed (e.g. admin search analytics, §5.7 of the scope doc)                                                                                                                                                                                    |
| Maps      | Mapbox or Leaflet + OpenStreetMap        | Per scope doc §10 — avoid Google Maps' dollar-denominated per-view billing                                                                                                                                                                                                                          |
| Markdown  | `react-markdown` 10                      | Blog post bodies only. Renders to React elements, never raw HTML — no separate sanitizer needed                                                                                                                                                                                                     |
| Tests     | `vitest` 4 + Testing Library + jsdom     | Config is [frontend/vitest.config.mjs](frontend/vitest.config.mjs) — **`.mjs`, not `.js`**, because this package isn't `"type": "module"` and Vite's native config loader warns otherwise. Vitest does not run the Next.js compiler, so server components/routing/SSR aren't covered by these tests |

> **If `react-router-dom` was previously pinned for security reasons in a sibling
> project's CLAUDE.md, that note does not apply here** — this project uses Next.js
> routing instead.

## Tech stack (backend — installed, no code written yet)

> Dependencies are installed; **no application code exists**. Don't start building
> resources/models until asked.

Express 5, Mongoose 9, `jsonwebtoken` + `bcrypt` (cookie auth), `multer` +
`cloudinary` (image uploads, incl. server-side compression/thumbnails/watermarking per
scope doc §10.3), `resend` (email), `node-cron` (§4.3 daily digest — the only
scheduled job in the app), `winston` (logging), `express-rate-limit`, `cors`,
`cookie-parser`, `dotenv`. ESM (`"type": "module"`) — use `import`, not `require`.
Tests: `vitest` + `supertest` + `mongodb-memory-server`, config in `backend/vitest.config.js`.

Domain-specific backend needs from the scope doc to keep in mind when this phase
starts (not exhaustive — re-read [docs/PROJECT-SCOPE.md §5](docs/PROJECT-SCOPE.md#5-ai-natural-language-search)
and [§8](docs/PROJECT-SCOPE.md#8-data-model) before building):

- A small/fast LLM call (with response caching, a strict JSON-only schema, and a hard
  monthly spend cap + fallback flag) for the natural-language search filter extraction —
  not a general chat/content-generation integration.
- A locations/alias table and a taxonomy table (property types, amenities) that
  whitelist-validate LLM output before it ever reaches a DB query.
- State-driven validation rules for rent terms (e.g. Lagos's 10% agency-fee cap, one-year
  advance-rent limit).

---

## Commands

```bash
# Frontend (run inside /frontend) — all working
npm run dev        # Next.js dev server (port 3000)
npm run build      # production build
npm start          # start production server
npm run lint       # oxlint (no .oxlintrc yet — runs on defaults, silent when clean)
npm test           # vitest run (config: vitest.config.mjs, not .js — see note below)

# Backend (run inside /backend) — all working
npm run dev        # nodemon index.js (port 5000, override with PORT)
npm start          # node index.js
npm run lint       # eslint (flat config: eslint.config.js)
npm test           # vitest run

# Seeding (needs MONGODB_URI set — no DB is configured yet, so untested against a real cluster)
npm run seed              # baseline only: taxonomy, locations, aliases, pages, settings, admin
npm run seed -- --demo    # + the 200 sample listings — DEVELOPMENT ONLY, never for a client
npm run seed -- --reset   # wipe seeded collections first (refuses when NODE_ENV=production)
```

When unsure which package a command belongs to, check the `scripts` block of
the relevant `package.json` rather than guessing. Do not assume a root-level
script exists unless you've seen it.

---

## Frontend conventions

### Tailwind CSS v4 — read this carefully

This project uses **Tailwind v4**, which is configured very differently from v3.
Do **not** apply v3 patterns, and don't copy the `@tailwindcss/vite` setup from a
Vite-based sibling project — Next.js needs its own v4 integration.

- There is no `tailwind.config.js`. Theme customization goes in CSS via
  `@theme` (file location TBD once the Next.js app is scaffolded — likely
  `frontend/app/globals.css` or equivalent).

### React 19

- New JSX transform: don't add `import React from 'react'` just to use JSX.
  Import hooks directly: `import { useState, useEffect } from 'react'`.
- `ref` is a regular prop on function components — **don't reach for
  `forwardRef`** unless interacting with older code that needs it.
- Prefer modern primitives where they fit: `use()`, `useActionState`,
  `useOptimistic`, form actions. Don't force them where a plain handler is clearer.

### Routing & rendering (Next.js)

- File-based routing under `frontend/app/` (or `pages/`, depending on which router the
  scaffold uses — confirm before adding routes, don't mix the two).
- **Listing and search pages must be server-rendered** — this is a product requirement
  (organic search is the primary acquisition channel), not a default to reconsider per-page.
- Use `<Link>` for navigation. Never use raw `<a href>` for internal routes.
- SEO-friendly listing URLs, e.g. `/property/4-bedroom-duplex-lekki-phase-1-REF1042`
  (see scope doc §4.1).

### Data fetching (Axios)

> **Two clients, deliberately.** Server Components read through
> [frontend/src/lib/api/server.js](frontend/src/lib/api/server.js) using `fetch` — Next's
> cache is fetch-based and Axios bypasses it entirely. The browser writes through the
> Axios instance below. Don't collapse them into one.

- Use the **single shared Axios instance** at
  [frontend/src/lib/api/client.js](frontend/src/lib/api/client.js) — never bare
  `axios.get(...)` at call sites. It is already configured with `withCredentials: true`
  (cookie auth) and a JSON `Content-Type`. Admin calls go through the wrappers in
  [frontend/src/lib/api/admin.js](frontend/src/lib/api/admin.js), which is the only
  place admin URLs are written.
- Put auth headers, error normalization, and 401 handling in **interceptors**,
  not in every call site.
- The base URL comes from an env var (`NEXT_PUBLIC_`-prefixed for anything the browser
  needs, matching Next.js's convention — not Vite's `VITE_` prefix). Never hardcode
  `localhost:PORT`.

### Forms (react-hook-form)

- Use `react-hook-form` for any form with more than one field. Don't build
  manual `useState`-per-input forms. This covers the enquiry form, viewing request,
  "list your property with us", and admin listing editor forms in particular.
- Validate via the library's `register` rules (or a resolver if one is added —
  none is installed yet, so no Zod/Yup unless added). Surface errors near fields.

### Icons & tooltips

- `react-icons`: import the specific icon from its set,
  e.g. `import { FiMenu } from 'react-icons/fi'`. Don't import the whole set.
- The `data-tooltip-id` API plus a single `<Tooltip />` instance is the intended
  pattern (not the legacy `data-tip` attribute) — confirm against the installed version.

### Toasts (react-hot-toast)

- Use `react-hot-toast` for transient notifications (e.g. enquiry submitted, saved).
- Create a single `<Toaster />` near your app root and call `toast()` from components or hooks.

### Public site look and feel

- **Section tone is the layout's main device, and it is a `Section` prop, not a `bg-`
  class.** `tone="light" | "raised" | "dark"` sets the ground *and* the heading colours
  together so a tone can never be half-applied. Pages alternate light and dark bands.
- **Gold's contrast flips with the ground: 2.2:1 on ivory, 6.6:1 on navy.** That is the
  whole reason the site alternates — navy is where the accent is allowed to be loud.
  Gold text on ivory uses `--color-accent-text`; a gold *fill* always carries navy text.
  Gold with white text (1.9:1) is never permitted.
- **Every navy region must carry the `on-dark` class.** `globals.css` hangs the
  light-ground focus ring off it; without it, keyboard focus vanishes inside that region.
  This is why it appears on the header, hero, dark sections, footer and mobile drawer.
- **The hero's free-text search and its structured panel are deliberately two controls.**
  `/properties` treats `q` and the filter params as mutually exclusive — a phrase goes to
  the natural-language endpoint and the structured filters are ignored — so merging them
  into one form would silently discard half the visitor's input.
- **The stats band and testimonials are placeholder content in `src/content/home.js`,
  flagged as such in that file.** `testimonialModel` exists but has no public endpoint;
  when one ships, `Testimonials` takes an `items` prop and the content block is deleted.
  Do not simply rename the placeholders — invented client quotes are a misrepresentation.
- **Footer and nav links only point at routes that exist.** Unbuilt sections are absent,
  not stubbed, and there is no newsletter form because there is no subscribe endpoint.
  The seller CTA (`siteConfig.listPropertyHref`) routes to `/list-your-property`.
- **All demo imagery is placeholder and credited in `frontend/public/CREDITS.md`** —
  `hero-home.jpg` from Unsplash, and the 600 listing photos hotlinked from Pexels via the
  committed catalogue at `backend/scripts/demoImages.js`. Every one of them shows a
  property with nothing to do with the agency, so they must be replaced with the client's
  own photography before launch. Refresh the catalogue with
  `node scripts/fetchDemoImages.js` (needs `PEXELS_API_KEY`; the keyless Pexels quota is
  a handful of requests and then 401s, so a full run cannot complete without a key).
- **The admin panel is deliberately excluded from this restyle** — it is a different
  product with its own chrome, and dragging the marketing look into it helps nobody.
- **Marketing-page copy (About/Services/Contact) is hardcoded in `src/content/`,
  same as the homepage — not `pageModel`-backed.** `pageModel` exists and is
  seeded, but nothing reads it and there is no admin editor to change it yet;
  building that read path was out of scope for the marketing-pages slice. This is
  a deliberate, discussed deviation from §9's DB-content preference — see
  `docs/PROJECT-SCOPE.md` §9 and
  `docs/superpowers/specs/2026-09-04-marketing-pages-design.md`. Team is the one
  exception: `agentModel` is real structured data, so it is served from a public
  API instead of being duplicated into a content file.

### Admin panel conventions

- **Route groups split the app.** `src/app/(site)/` holds the public pages and mounts
  `Header`/`Footer`; `src/app/admin/` has its own chrome. Parentheses contribute nothing
  to the URL, so every public path is unchanged. `not-found.js` and `error.js` live in
  `(site)` — a root-level `not-found` renders outside every group's layout and would lose
  the navigation. **`sitemap.js` and `robots.js` stay at `app/` root.**
- **The admin is client-rendered; the public site is server-rendered.** Deliberate: the
  admin has no SEO need and cookie auth is already wired into the Axios instance. Don't
  "fix" the inconsistency.
- **Auth is three layers, and only the third is real.**
  1. `src/proxy.js` — Next 16 renamed Middleware to **Proxy**. It checks cookie
     _presence_ only, to avoid flashing empty chrome. It is an **optimistic check, never
     authorization** — the signing key is the backend's.
  2. `AdminSessionProvider` calls `/api/auth/me` once and renders **nothing** until it
     resolves, so screens can read `user.role` unconditionally.
  3. The API. `requireAuth` re-loads the account every request. This is the gate.
- The Axios 401 interceptor redirects to `/admin/login`, guarded against the login page
  itself (where a 401 is just a wrong password). Handled once — never per call site.
- **Admin reads go through `useAdminResource`**, which discards stale responses so fast
  filter changes can't render an older result set over a newer one. **Mutations don't** —
  they call `lib/api/admin.js` directly, then `refetch()`. No optimistic updates, on
  purpose: a wrong optimistic state on a lead is worse than a short wait.
- All admin URLs live in `src/lib/api/admin.js`. Never build one at a call site.
- **`src/lib/viewingTransitions.js` mirrors the backend table with one-way authority:**
  it decides which _buttons render_; the backend decides what is _allowed_. On a drift the
  API's 400 is shown verbatim. Never invert this by trusting the frontend copy.
- **Role-gated controls are courtesy, not security.** The API enforces permissions
  regardless of what renders. Hiding Delete from an agent is a nicety; the 403 is the rule.
- Inbox and diary keep **selection and filters in the URL** (`?id=`, `?status=`), the same
  discipline as the public search. Changing a filter clears the selection, because the
  selected row may not survive the new filter. The listings table follows suit
  (`?publicationState=`, `?q=`, `?includeDeleted=`, `?page=`); changing a filter resets
  to page 1.
- **The listing editor is one long form, not a wizard or tabs**, and it lives at its own
  route rather than in a detail pane. Nine sections don't fit a master-detail column, a
  wizard optimises for first creation when the common job is changing one field, and tabs
  hide validation errors on panels nobody is looking at.
- **Enum lists are never mirrored in the front end.** `GET /api/admin/reference` serves
  them from `constants.js` — the same lists the schema enums and the AI-search validator
  use. A local copy would drift the first time an enum gained a member. This includes the
  **land-unit factors**: the API takes only `landSizeSqm`, so the client converts, and a
  hardcoded "a plot is 648 sqm" silently mis-stores Lagos land, where it is ~464.
- **`state` is displayed in the editor but never submitted.** The server derives it from
  the chosen area, and that derivation is what stops a Lagos listing being filed under
  another state to slip past the 10% agency-fee cap. Same one-way authority as
  `viewingTransitions.js`.
- **The form's validation rules are advisory; the API's are the rule.** A 400's `details`
  is keyed by dotted field path, which `lib/apiErrors.js` maps onto the matching input —
  and anything with no matching field goes to a form-level banner verbatim rather than
  being swallowed.
- **Listing deletion is soft and reversible**, unlike a lead's, which is a permanent NDPA
  erasure. The confirmation wording has to say which one it is. **Image deletion is a
  third case** — it destroys the Cloudinary asset, so it is permanent like a lead's, and
  `MediaManager`'s dialog says so. **Staff deactivation is a fourth** — always
  reversible (reactivate any time), never a delete; `StaffTable`'s confirmation wording
  says "deactivate," never "delete."
- **The registration endpoint believes nothing the client sends but `publicId` and `alt`.**
  The browser uploads straight to Cloudinary, so the API never sees the bytes; it calls
  `cloudinary.api.resource()` and reads url, dimensions and byte count from *Cloudinary's*
  answer. A client-supplied url would make the record point anywhere, and client-supplied
  dimensions would poison the layout-space reservation on every page the image appears on.
  The folder check runs **before** that lookup, so the endpoint cannot be used to probe
  which public ids exist in the account.
- **The signed parameter set is a two-file contract.** Cloudinary recomputes the signature
  over the parameters it receives, so `buildUploadSignature` in
  [mediaSignature.js](backend/utils/mediaSignature.js) and the `FormData` in
  [uploadMedia.js](frontend/src/lib/uploadMedia.js) must list exactly the same fields.
  Adding one to either alone fails every upload with "Invalid Signature".
- **Media mutations commit immediately; the cover does not.** Upload, reorder, alt text
  and delete all fire on the spot and then `refetch()`. A photo is a file on a server, not
  a form field — tying it to Save means a validation failure elsewhere in a nine-section
  form silently discards a completed upload. Cover selection stays a react-hook-form value
  because it is a property of the *listing*. This is why the editor at
  `/admin/properties/new` cannot upload at all: with no listing id there is no folder and
  no ownership check, and a temporary folder would orphan billable assets on every
  abandoned draft.
- **Uploads cap at 15MB and there is no chunked/resumable path.** 15MB sits under
  Cloudinary's 20MB single-request limit, so a `Content-Range` branch would never execute
  — and a branch that never runs is a branch that is never right. Raising the cap past
  20MB is when chunking gets written, and tested.

---

## Backend conventions (Express/Node)

> These are the established patterns, not aspirations — the models, routes and
> controllers below all exist. Match them rather than introducing a new shape.

Layout under `/backend`:

```
index.js        server entry (starts HTTP server)
app.js          createApp() — Express app, CORS, routes mounted under /api
routes/         one file per resource
controllers/    one file per resource, business logic
model/          Mongoose schemas (singular "model", not "models")
middleware/     verifyToken, authorizeRole, upload (multer), rateLimiter
utils/          emailService, logger, aiSearchClient (LLM filter extraction)
config/         db.js (Mongoose connection), cloudinary.js
emails/         email templates
scripts/        runnable CLI scripts (seed.js) — added to the original layout
tests/          vitest + supertest + mongodb-memory-server
```

- Keep route files thin; business logic goes in controllers, shared helpers in
  `utils/`. There is no separate `services/` layer — don't add one.
- Mongoose schemas in `backend/model`, one per file, named `xModel.js`.
- **Mongoose 9 breaking change:** `pre`/`post` middleware takes **no `next()` callback** —
  hooks must be `async`. Also: no `background` index option, and update pipelines
  (arrays passed to `updateOne`/`findOneAndUpdate`) throw unless `updatePipeline: true`.
  See the [Mongoose 9 migration guide](https://mongoosejs.com/docs/migrating_to_9.html).
- **Never inline a controlled value list in a schema.** Every enum/whitelist lives in
  [backend/utils/constants.js](backend/utils/constants.js), because the AI search
  validator (scope §5.2 step 4) must check the model's extracted filters against the
  exact same lists the DB enforces. Two copies = the model can emit a "valid" filter
  the database has never heard of.
- Land areas are stored in **square metres only** — use `toSquareMetres()`. A "plot"
  is ~648 sqm generally but ~464 sqm in parts of Lagos, so storing plots means the
  same number denotes different areas by location.
- Statutory rent limits are enforced at **write time** in `propertyModel`'s
  `pre("validate")`, driven by `STATE_RENT_RULES`. Don't move this to display logic —
  publishing terms that breach Lagos's 10% fee cap / one-year advance limit is a legal
  exposure for the client (scope §8.2).
- **`searchLogModel` must never gain a personal-data field** (name, email, phone, IP,
  user id). §5.7 excludes personal data from these logs, and a test asserts the schema
  has nowhere to put it. Identifying data belongs on `enquiryModel`, where consent is
  recorded.
- Read site config through `Settings.get()` — it's a singleton (`key: "site"`) that
  self-creates. Brand values (colours, fonts, logo) live in its `theme` block and
  **nowhere else** (§9); never hardcode a brand value in a component.
- **Seeding rules:** the seed must stay idempotent and use `$setOnInsert` for content
  (pages, settings, taxonomy) — re-running it after a client has edited their copy
  must never revert their edits. Demo listings stay behind `--demo` and must never be
  part of a client provision. Never hardcode a seed admin password; it comes from
  `SEED_ADMIN_PASSWORD` or is randomly generated and printed once.
- For a nullable unique field, use a **partial** index
  (`partialFilterExpression: { field: { $type: "string" } }`), not `sparse` — sparse
  skips only missing fields, so explicit `null`s still collide. See `pageModel.slug`.
- All secrets and connection strings come from environment variables via
  `process.env`. **Never** commit or hardcode them, and never put them in client
  code (only `NEXT_PUBLIC_`-prefixed vars reach the browser, by design).
- Centralized error-handling middleware; controllers should `throw` or
  `next(err)` rather than sending ad-hoc error responses.
- Validate request input at the boundary before it reaches the database — this is
  especially important for the AI search endpoint (whitelist-validate LLM output
  before it becomes a DB query; see scope doc §5.1/§5.6).
- **Response shape is settled — use it everywhere.** Success:
  `{ success: true, data: {...} }`. Failure: `{ success: false, message, details?, stack? }`
  (`details` only for field-level validation errors; `stack` is stripped in production).
  Never hand-roll a different shape.
- Throw `new ApiError(status, message, details?)` from
  [backend/utils/ApiError.js](backend/utils/ApiError.js) rather than calling
  `res.status(...).json(...)` on a failure path. Express 5 forwards async throws to
  the error handler automatically — **no try/catch wrapper or `express-async-handler`
  needed**.
- Mongoose `ValidationError` / `CastError` / duplicate-key (11000) are already
  translated to 400/400/409 in the error handler — don't re-handle them per controller.
- Apply `strictLimiter` (not just the global `apiLimiter`) to any endpoint that costs
  money or sends mail per call: AI search, enquiry submission, viewing requests, OTP.

---

## API endpoints (public, built)

> **Building anything that consumes the API?** Read
> [docs/API-REFERENCE.md](docs/API-REFERENCE.md) first — it has the actual response
> shapes (captured from the running API, not from memory) plus the frontend traps,
> the worst of which is that `price` is truthy even on rentals, so `if (property.price)`
> is always wrong.

| Method | Path                                      | Notes                                                                                                                                                                               |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                             | Liveness + DB connection state                                                                                                                                                      |
| GET    | `/api/properties`                         | Search: `listingType`, `propertyType`, `location`, `state`, `bedroomsMin/Max`, `bathroomsMin`, `priceMin/Max`, `amenities`, `titleType`, `isFeatured`, `q`, `sort`, `page`, `limit` |
| GET    | `/api/properties/featured`                | Homepage rail — must stay declared before `/:slug`                                                                                                                                  |
| GET    | `/api/properties/:slug`                   | Detail + gallery + related listings                                                                                                                                                 |
| GET    | `/api/locations` · `/api/locations/:slug` | Area pages; detail includes available listing count                                                                                                                                 |
| GET    | `/api/taxonomy`                           | Grouped by category for the filter panel                                                                                                                                            |
| GET    | `/api/agents` · `/api/agents/:slug`       | Public team roster and profile pages (§3); `isPublic && isActive` only                                                                                                              |
| GET    | `/api/testimonials`                       | Curated client feedback (§3), published + ordered only; `?limit=`                                                                                                                   |
| GET    | `/api/blog` · `/api/blog/:slug`           | Blog index + post (§4.1), published-only, 404 parity with drafts/deleted; `?page&limit`                                                                                             |
| GET    | `/api/filters`                            | One call for all filter controls, incl. real price bounds                                                                                                                           |
| GET    | `/api/settings`                           | Curated public projection — never the AI spend cap or analytics ids                                                                                                                 |
| POST   | `/api/enquiries`                          | Lead capture, `strictLimiter`                                                                                                                                                       |
| POST   | `/api/viewings`                           | Viewing request, `strictLimiter`                                                                                                                                                    |
| POST   | `/api/search`                             | Natural-language search (§5), `strictLimiter`                                                                                                                                       |

### AI natural-language search — the rules that matter

The pipeline is: normalise → **parse cache** → **deterministic parser** → _(model, only
if needed and permitted)_ → whitelist validation → same query engine → chips.

- **The model never writes property information.** It only emits a filter object,
  which runs through `buildPropertyQuery` exactly like the filter panel's. This is
  §5.1's structural guarantee against invented bedrooms/prices — do not add a path
  where model text reaches a response.
- **A deterministic parser runs first** ([nigerianPhraseParser.js](backend/utils/nigerianPhraseParser.js)):
  prices (`₦100m`, `N100 million`, `one hundred million`, `500k`), `to let` → rent,
  Nigerian property types, C of O / excision / gazette. **The parser wins every
  conflict with the model** — a regex that matched "₦100m" is exact; the model is
  inference. If it understood ≥2 dimensions, the model is not called at all.
- **Place names and amenities are matched by scanning the client's own vocabulary**
  (`matchLocationsInPhrase` / `matchAmenitiesInPhrase`), not by the model — so
  "3 bedroom flat in Lekki" works with AI switched off, which is the default state.
  Matching includes **leading-word prefixes** of multi-word area names, because people
  search "Lekki" not "Lekki Phase 1", and "Ikeja" not "Ikeja GRA". Prefixes under four
  characters are skipped so "Old"/"New" can't hijack a phrase. An umbrella term
  contributes _every_ area it covers, so don't reintroduce match-and-consume per
  location.
- **Zero-result relaxation widens to the state, not nationally.** A Lekki searcher
  shown houses in Enugu reads as a broken search. `relaxFilters` takes a
  `{ state }` context from the matched areas; the rung is reported as `nearby_areas`.
- **Model default is `claude-haiku-4-5`** (`AI_SEARCH_MODEL` overrides). §5.6 requires
  a small fast model: filter extraction is a simple structured task. Uses
  `output_config.format` json_schema with every constrained field enumerated from
  `constants.js`, so the model cannot emit a type the DB doesn't have.
- **`extractFilters` never throws.** Timeout (2s), rate limit, outage, refusal — all
  return `ok:false` and the search continues on deterministic filters. §5.6 requires
  the filter interface stay fully functional at all times.
- **Spend controls are not optional:** `Settings.aiSearch` holds the kill switch,
  monthly USD cap, running spend and timeout. Cap reached → model calls stop, search
  keeps working. Cost is charged even when a call fails.
- **Chips show what the visitor asked for, never the relaxed version.** If a search is
  widened to find results, that's reported in `relaxed`, not by rewriting the chips.
- Prompt injection is handled structurally, not by prompt wording: the model can only
  emit whitelisted filters, so injected instructions have nothing to act on.

## API endpoints (authenticated, built)

| Method       | Path                                   | Notes                                                                              |
| ------------ | -------------------------------------- | ---------------------------------------------------------------------------------- |
| POST         | `/api/auth/login` · `/api/auth/logout` | Cookie JWT; login throttled to 10 failures / 15 min                                |
| GET          | `/api/auth/me`                         | Restores admin-panel session on reload                                             |
| POST         | `/api/auth/change-password`            | Signs the session out afterwards                                                   |
| GET/POST     | `/api/admin/properties`                | Table (drafts + deleted) and create                                                |
| GET          | `/api/admin/properties/:id`            | One listing **plus its media gallery** — the editor's load                         |
| PATCH/DELETE | `/api/admin/properties/:id`            | Update; DELETE is a **soft** delete                                                |
| POST         | `/api/admin/properties/:id/restore`    | Undo a soft delete                                                                 |
| POST         | `/api/admin/properties/:id/feature`    | **Administrator only**                                                             |
| GET          | `/api/admin/reference`                 | Editor vocabulary: enums, rent rules, land-unit factors, areas, taxonomy, `staffRoles`, and (administrators only) the active roster as `agents` |
| GET/POST     | `/api/admin/staff`                     | **Administrator only.** Full roster incl. inactive / create a staff account        |
| GET/PATCH    | `/api/admin/staff/:id`                 | **Administrator only.** One account / update, deactivate, reset password          |
| GET/POST     | `/api/admin/blog`                      | **Administrator only.** Table (drafts + deleted) and create                       |
| GET          | `/api/admin/blog/:id`                  | **Administrator only.** One post, for the editor                                  |
| PATCH/DELETE | `/api/admin/blog/:id`                  | **Administrator only.** Update; DELETE is a **soft** delete                       |
| POST         | `/api/admin/blog/:id/restore`          | **Administrator only.** Undo a soft delete                                        |
| GET/PATCH    | `/api/admin/settings`                  | **Administrator only.** Full `settingsModel` singleton; `theme`/`aiSearch` deep-merge on PATCH |
| POST         | `/api/admin/properties/:id/media/signature` | Scoped Cloudinary upload signature, `strictLimiter`                          |
| POST         | `/api/admin/properties/:id/media`      | Register an uploaded asset — body carries `publicId` (+ `alt`) and nothing else    |
| PATCH        | `/api/admin/properties/:id/media/order` | Reorder; `ids` must be a **full permutation**                                    |
| PATCH        | `/api/admin/properties/:id/media/:mediaId` | Alt text only                                                                 |
| DELETE       | `/api/admin/properties/:id/media/:mediaId` | **Permanent** — destroys the Cloudinary asset too                             |
| GET          | `/api/admin/enquiries`                 | Inbox: `status`, `type`, `source`, `agent`, `property`, `q`, `dateFrom/To`, `sort` |
| GET          | `/api/admin/enquiries/stats`           | Counts by status — must stay declared before `/:id`                                |
| GET/PATCH    | `/api/admin/enquiries/:id`             | Detail incl. `notes`; PATCH writes `status`, `notes`, `agent`                      |
| DELETE       | `/api/admin/enquiries/:id`             | **Administrator only**, and a **hard** delete                                      |
| GET          | `/api/admin/viewings`                  | Diary, soonest-first; `upcoming=true` hides the past                               |
| GET/PATCH    | `/api/admin/viewings/:id`              | Detail incl. `notes`; PATCH drives the state machine                               |
| DELETE       | `/api/admin/viewings/:id`              | **Administrator only**, and a **hard** delete                                      |

**Staff management rules:**

- **No hard delete of an `Agent`, ever.** `Property.agent`, `Enquiry.agent`,
  `Viewing.agent` and `Testimonial.agent` all reference the account; deleting it would
  orphan that history. "Remove a staff member" is `PATCH { isActive: false }`, which
  `login` already checks.
- **An administrator cannot deactivate or demote their own account** — 400, not a
  silent no-op. The one guard against a single-admin agency locking itself out.
- The initial password is administrator-typed (≥8 characters, same rule as
  `change-password`) — there is no email invite or password-reset flow in this project.
- Renaming a staff member re-slugs their public `/team/[slug]` profile URL, the same
  behaviour `updateProperty` already has for a retitled listing. Two staff members
  sharing a name get `-2`, `-3`, … appended.
- The admin list (`GET /api/admin/staff`) deliberately includes inactive accounts —
  the public `/api/agents` roster still excludes them; don't loosen that one.

**Blog management rules:**

- **Administrator only, no ownership scoping** — unlike listings and leads, §7's role
  table lists blog under Administrator, not Agent, so `authorizeRole("administrator")`
  gates the whole `/api/admin/blog` router rather than a per-caller query filter.
- **Soft delete, not hard**, same reasoning as Property: a post's URL may be linked
  from elsewhere. `DELETE` forces `publicationState` back to `draft`; `restore` only
  clears `deletedAt` and does **not** re-publish.
- **`slug` is always server-generated** from `title`, with a `-2`, `-3`, … suffix on
  collision (same inline pattern as `uniqueAgentSlug`) — never accepted from the body.
- **`publishedAt` is stamped once**, by the model's own `pre("save")` hook — an
  unrelated edit after publishing must not move it.
- **Post bodies are Markdown, rendered with `react-markdown` on the frontend** — never
  `dangerouslySetInnerHTML`. A compromised or careless admin account can write
  Markdown but not inject a script through it.
- **`categories`/`tags` are free-form strings**, not a taxonomy reference — unlike
  Property's checkbox-driven `tags`, they don't gate any search filter and aren't
  whitelist-validated.
- **`locations` cross-linking is deferred** — the schema field exists but is not
  writable through this API; neighbourhood pages don't exist yet either, so there is
  nothing to cross-link to.

**Lead operation rules:**

- **Agents see only leads assigned to them; unassigned leads are administrator-only.**
  A contact-page enquiry belongs to nobody until an admin assigns it. `scopeLeadQuery`
  in [auth.js](backend/middleware/auth.js) is applied **last** when building a list
  query, so `?agent=<colleague>` can never widen an agent's scope. Don't reorder it.
- Ownership violations return **403** here, not 404 — these are authenticated
  colleagues. The public surface still 404s; that rule is unchanged.
- **Deletion is hard, not soft, and administrator-only.** NDPA 2023 erasure means the
  personal data is gone; a tombstone keeping name/phone/email answers no erasure
  request. This deliberately differs from the soft delete on properties.
- **Viewing status transitions are enforced** by
  [viewingTransitions.js](backend/utils/viewingTransitions.js), not by the UI hiding a
  button. Re-applying the current status is a no-op, not a 400 — a double-clicked
  Accept must not error. `accepted` inherits `requestedFor` when no `scheduledFor` is
  given; `rescheduled` requires a _different_ future one.
- `contactedAt`, `closedAt` and `respondedAt` are stamped by model hooks and are **not**
  in either `WRITABLE_FIELDS`. They are response-time metrics — a writable timestamp is
  a falsifiable one. Controllers use `save()`, never `findByIdAndUpdate`, so the hooks
  actually run.
- `notes` is `select: false` on both models: absent from lists, explicitly selected on
  detail. Never surface it publicly.
- Prospect emails on accept/reject/reschedule are sent **after** the response and are
  best-effort, matching the public lead endpoints. A mail failure must never undo a
  status change.

**Auth rules:**

- Token lives in an **httpOnly cookie** (`re_token`), never a response body or
  `localStorage`. Front end relies on Axios `withCredentials: true`.
- `requireAuth` **re-loads the account on every request** rather than trusting the
  JWT payload — otherwise a deactivated or demoted staff member keeps access until
  the token expires (up to 7 days).
- **A stale `re_token` cookie must be cleared server-side (`/api/auth/logout`, no
  auth required) before the frontend redirects to `/admin/login` on a 401** — the
  Axios interceptor ([client.js](frontend/src/lib/api/client.js)) does this and is the
  **only** place that redirects on 401. `proxy.js` checks cookie *presence* only, so if
  anything else (e.g. `AdminSessionProvider`) redirects to `/admin/login` first, without
  clearing the cookie, `proxy.js` bounces it straight back to `/admin`, which 401s again
  — an infinite redirect loop that looks like the page re-rendering every second. Don't
  add a second 401→redirect path.
- Login returns one generic error for both "wrong password" and "no such account".
  Don't "improve" this: distinguishing them makes the endpoint an account-enumeration
  oracle.
- There is **no registration endpoint** (§7) — administrators create staff accounts.
- Admin writes go through `WRITABLE_FIELDS` allow-listing in
  [adminPropertyController.js](backend/controllers/adminPropertyController.js).
  `viewCount`, `isFeatured`, `deletedAt`, `reference`, `slug`, `publishedAt` and
  ownership are all server-controlled; never widen that list casually.
- `state` is always derived from the chosen location, never accepted from the body —
  a client could otherwise send a different state to bypass the Lagos rent cap.
- Publishing is gated by the agent's `canPublish` flag (§7's client decision);
  featuring is administrator-only.

**Query-engine rule (scope §5.1):** all property filtering goes through
[backend/utils/buildPropertyQuery.js](backend/utils/buildPropertyQuery.js), and all
name→id resolution through
[backend/utils/resolveFilters.js](backend/utils/resolveFilters.js). When the AI search
endpoint is built it **must reuse both** — the model's only job is to emit a filter
object that enters the same path as the filter panel's. A second query builder would
let the AI path return results the filter UI cannot reproduce, which is the exact
failure mode §5.1 exists to prevent.

Other invariants worth keeping:

- The public scope (`publicationState: "published"`, `deletedAt: null`) is applied
  unconditionally inside the query builder, not per call site.
- A draft or soft-deleted listing must **404 like a non-existent one** — a different
  response leaks that the reference exists.
- Lead-capture endpoints respond **before** sending email; notifications are
  best-effort and must never fail the save. The lead is the only unrecoverable thing.
- Zero-result searches walk the §5.5 relaxation ladder and report what was relaxed;
  they never return a bare empty page.

---

## Environments (MongoDB Atlas) — connected

`backend/.env` exists (gitignored) and the dev database is live and seeded.

- **Shared Atlas cluster** (`ClusterVelox`), also hosting sibling projects:
  `velox_tech`, `gmbe`, `gmbe_dev`, `gsl`, `gsl_dev`, `hangoverlounge`, and a real
  `test` database.
- **This project's databases:** `realestate_dev` (seeded: 200 demo properties, 600
  media, 8 demo agents, 32 locations, 19 taxonomy terms, 8 pages, settings, 1 admin)
  and `realestate_prod` (not created yet).

> ⚠️ **The connection string must carry NO database path.** The database is selected
> by `MONGODB_DB_NAME` and set explicitly in
> [config/db.js](backend/config/db.js). On this cluster an unqualified Atlas string
> makes Mongoose use `test` — which is a real database here, belonging to another
> project. Writing there would be silent and would corrupt someone else's data.

Seeding (PowerShell swallows `--` args, so call the script directly):

```bash
node scripts/seed.js            # baseline only
node scripts/seed.js --demo     # + 200 demo listings (dev only)
node scripts/seed.js --reset    # wipe first; refuses when NODE_ENV=production
```

---

## Design & UI tools — always use these for UI work

When building any page, component, or UI feature:

1. **Invoke `ui-ux-pro-max` skill first** — establishes style, palette, font pairing, layout, and component choices before writing code. Never skip this for page-level or component-level UI tasks. Given the reusable-template requirement (scope doc §9), keep brand values (colours, logo, copy) out of components — pull from theme config, so a copied repo can be rebranded from one place.
2. **Use the shadcn/ui MCP server if it is connected** — query it for accurate component examples and usage patterns rather than relying on memory for shadcn APIs. It is _not_ currently in the connected server list; if it's missing, say so instead of guessing component APIs.

---

## Code style

- Match existing formatting (Prettier/ESLint config if present) — don't reformat
  unrelated lines in a diff.
- Components: PascalCase files for components, camelCase for hooks/utilities.
- Keep components focused; extract shared logic into hooks (`useX`) rather than
  duplicating.
- No new dependencies without flagging it first — call out the addition and why.

### Comments (required)

**Every piece of functional code you generate must be commented — frontend and
backend, no exceptions.**

- Each function, component, hook, controller, middleware, model, and service
  gets a short block comment above it saying what it does, what it takes, and
  what it returns.
- Inside functions, add inline comments on non-obvious logic: conditionals,
  loops, async flows, socket handlers, DB queries, error branches.
- Explain **why**, not just **what** — the code already says what it does.
- Comment JSX sections in React components (layout regions, conditional
  renders, mapped lists) and each field/index in Mongoose schemas.
- Keep comments accurate when editing existing code — update stale ones instead
  of leaving them wrong.

# Token-saving rules

- Keep responses under 100 words.
- Do not narrate actions.
- Do not explain code unless asked.
- Make changes directly.
- Summarize edits in bullet points only.
- When working, provide status updates in one sentence only.
- Highlight every line of code you edit or add (e.g. via a code-link reference or inline callout) so the user can spot exactly what changed.

---

## When unsure

- Read [docs/PROJECT-SCOPE.md](docs/PROJECT-SCOPE.md), the relevant `package.json`,
  and existing files in the same folder before introducing a new pattern.
- Prefer matching an established pattern in the repo over a "more correct" one
  from scratch.
- If a request conflicts with these notes, ask rather than silently choosing.

---

## Before writing code

- Read the surrounding files.
- Match existing coding style.
- Prefer existing utilities.
- Don't introduce new libraries unless requested.
- Explain major architectural decisions.
- Keep commits small.
- Avoid duplicate code.
- Ask questions if requirements are ambiguous.
- **Update the docs as part of the change, not afterwards** — see "Keeping the docs
  current" at the top of this file for which file to touch when. A change isn't
  finished while the docs still describe the old behaviour.

# Real Estate Agency Website — Scope

Reference doc transcribed from `Real-Estate-Agency-Website-Scope.pdf`. Treat this as
the source of truth for product scope; `CLAUDE.md` holds tooling/dev conventions.

## 1. Scope decision

Website for **a single real estate agency**, publishing that agency's own listings.
Not a marketplace — no third-party agents, no platform revenue (may be revisited at scale).

Commercial purpose: **lead generation**. A prospect finds a property via on-site search
or Google, then contacts the agency. Every feature serves that outcome.

Secondary objective: the codebase must be **re-themeable and resellable** to other
agency clients — an architectural requirement from day one, not an afterthought.

**The one AI feature retained:** natural-language property search (Phase 1). A visitor
types e.g. "3 bedroom flat in Lekki under ₦100m with parking" and the system returns
real listings from the database, plus related listings. See §5 for guardrails against
the model inventing properties.

## 2. Removed from the original brief

The marketplace concept — no third-party agent listings, no platform revenue model.

## 3. Missing from the original brief

The source brief specified only a listings database. An agency site is a marketing
site that happens to contain listings. Marketing pages added:

- **Homepage** — hero with search entry point, featured properties, services summary,
  recent listings, testimonials, clear CTA
- **About the agency** — history, credentials, years in operation, LASRERA/professional
  registration numbers
- **Services pages** — sales, lettings, property management, facility management,
  valuation, land banking (each its own page/SEO entry point)
- **Meet the team** — agent profiles (trust signals + referral landing pages)
- **Testimonials** — agency-curated, not public reviews
- **Contact** — office address, map, phone, WhatsApp, hours, enquiry form
- **"List your property with us"** — landing page/form for landlords and sellers;
  the agency's supply pipeline, arguably the most commercially valuable page
- **Areas we cover** — one page per neighbourhood (Lekki, Ikoyi, Ajah, Ikeja GRA,
  Maitama, Wuse, etc.) — cheap to build, strong organic traffic source

## 4. Phase 1 — core build (6–8 weeks, launchable)

### 4.1 Public site
- Homepage: natural-language + filter-based search entry points
- Property search: filters = location, listing type, property type, price range, bedrooms
- Search results: grid/list views, sort by price/recency, pagination
- Property detail page: gallery, price, key facts, description, amenities, map pin,
  floor plan, assigned agent card, enquiry form, WhatsApp button, call button, share
- SEO-friendly URLs, e.g. `/property/4-bedroom-duplex-lekki-phase-1-REF1042`
- Neighbourhood landing pages
- Agent profile pages (listing that agent's properties)
- Services, About, Team, Testimonials, Contact pages
- "List your property with us" landing page + form
- Blog / market insights (categories, tags)
- Legal pages: terms of use, privacy notice, listing disclaimer, cookie notice

### 4.2 Admin panel
- Secure login
- Listing create/edit/soft-delete; draft + published states
- Listing status: available, under offer, sold, rented, off-market
- Media upload: drag-and-drop ordering, cover image, auto compression/thumbnails/watermark
- Assign listing to agent
- Feature a listing for homepage placement (admin toggle, not a paid boost)
- Enquiry inbox: enquirer, property, date, status (new/contacted/viewing booked/closed)
- Viewing requests: accept/reject/reschedule
- Staff management: add/remove agents, assign roles
- Blog editor
- Site settings: contact details, social links, hours, homepage copy
- Search analytics — what visitors searched for and what returned nothing (§5.7)

### 4.3 Notifications
- New enquiry → email to assigned agent + WhatsApp click-to-chat link to prospect
- New viewing request → email to agent, confirmation email to prospect
- Daily digest of new enquiries to admin

### 4.4 SEO & technical foundation
- Server-side rendering on listing/search pages (organic search is the primary channel)
- Auto-regenerating sitemap + robots.txt
- Meta titles/descriptions + Open Graph images per listing
- `RealEstateListing` + `Organization` structured data markup
- Breadcrumbs, canonical URLs
- Google Analytics + Search Console

## 5. AI natural-language search

### 5.1 Critical design decision
The AI model **never writes property information** — its only job is converting a
phrase into structured filters, which run through the same query engine as ordinary
filter search. Results always come from real DB records. This structurally prevents
invented bedrooms/amenities/prices attached to the agency's brand.

### 5.2 How it works
1. Visitor submits a phrase.
2. Phrase normalized, checked against a cache of previously parsed queries.
3. On cache miss: sent to a small, fast LLM with a strict output schema — JSON only, no prose.
4. Returned JSON validated against whitelists (locations table, taxonomy for property
   types/amenities, sane numeric bounds). Unrecognized values are discarded, not passed through.
5. Validated filters run as an ordinary indexed DB query.
6. Real listings rendered as standard property cards.
7. Interpreted filters shown as editable chips so visitors can see/correct the interpretation.

### 5.3 Example
Input: `"3 bedroom flat in Lekki under 100 million with parking and a pool"`

```json
{
  "listing_type": "sale",
  "property_type": "apartment",
  "bedrooms_min": 3,
  "location": ["Lekki"],
  "price_max": 100000000,
  "currency": "NGN",
  "amenities": ["parking", "swimming_pool"]
}
```
Rendered chips: `Apartment · 3+ beds · Lekki · Under ₦100m · Parking · Pool` (each removable).

### 5.4 Nigerian language handling
An alias table sits between model output and the DB (content work, populated with the client):
- **Property types** — self-contain/self-con, mini flat, room and parlour, flat vs apartment,
  duplex, terrace, semi-detached, detached, bungalow, BQ
- **Listing intent** — "to let" = rent (Nigerian norm), "for sale", "up for grabs", "available"
- **Prices** — "100m", "₦100m", "N100 million", "one hundred million", "100k per month"
  (naira and dollar figures both appear in high-end Lagos/Abuja listings)
- **Locations** — Lekki Phase 1, Chevron, Ikate, Osapa, Agungi, Ajah, Sangotedo, Ikoyi, VI,
  Ikeja GRA, Magodo, Maitama, Wuse — informal names/misspellings alias to canonical records
- **Title and land** — "C of O", "Governor's Consent", "excision", "gazette",
  "registered survey", "plot", "half plot", "acre", "hectare"
- **Amenities** — serviced, gated estate, 24/7 power, borehole, prepaid meter, BQ, penthouse

### 5.5 When nothing matches
- Relax constraints in order: price band ±10%, then adjacent neighbourhoods, then bedroom
  count — state plainly what was relaxed
- Show closest available alternatives rather than an empty page
- Offer a "notify me" lead-capture alert for the unmet requirement
- Log the failed search for stock acquisition planning

### 5.6 Cost and reliability controls
- Cache aggressively (normalized phrase → parsed filters); most searches shouldn't reach the model
- Use a small, fast model — filter extraction doesn't need a frontier model
- Rate limit per session and per IP
- Hard monthly spend cap + alerting; feature flag to disable AI search and fall back to
  filters if cap hit, provider down, or request exceeds a 2s timeout
- Classic filter UI stays fully functional and visible — AI search is additive, never the only path
- Treat submitted text as untrusted input; since the model can only emit whitelisted filters,
  injected instructions have nothing to act on

### 5.7 Search analytics
Every parsed query logged with filters, result count, and enquiry conversion. Produces a
demand report (areas searched, budgets, dead-end searches) that directly informs stock
acquisition. Personal data excluded from these logs.

**Effort:** ~1 week within Phase 1, assuming ordinary filter search exists. The alias
table (§5.4) is content work, populated with the client during content loading.

## 6. Phase 2 and optional modules

### 6.1 Phase 2 — engagement (~3 weeks)
- Visitor accounts via phone-first OTP login
- Saved properties + saved searches
- Alerts (email/WhatsApp) for new matches and price reductions
- Recently viewed properties
- Property comparison
- Map-based search with marker clustering
- Agent dashboard: my listings, my enquiries, my viewings, view counts
- Mortgage / payment-plan calculator

### 6.2 Optional modules (quoted separately)

| Module | Notes | Effort |
|---|---|---|
| Off-plan developments | `Development` entity above `Property`: unit types, completion date, construction status, instalment plans. Essential (not optional) if client is a developer. | 2 weeks |
| Short-let booking | Calendar, availability blocking, nightly/weekly rates, min stay, cancellation policy — a booking product, not a listing type | 3 weeks |
| Tenant portal | Rent due dates, maintenance requests, receipts — strong upsell for agencies managing buildings for landlords | 3 weeks |
| Dual currency display | Naira/dollar toggle for high-end stock | 3 days |
| Content migration | Loading existing listings + photos, per 50 listings | 2–4 days |

## 7. Roles and permissions

Three roles (replacing a six-tier hierarchy in the original brief):

| Role | Permissions |
|---|---|
| Administrator | Full access — staff, all listings, all enquiries, blog, site settings, search analytics |
| Agent | Create/edit own listings, view own enquiries/viewings, edit own profile. Direct-publish vs. admin-approval is a client decision. |
| Visitor | Browse, search, submit enquiries. Saved properties/alerts in Phase 2. |

No self-service agent registration — administrator creates staff accounts (eliminates
abuse/spam/identity-verification work).

## 8. Data model

### 8.1 Collections
- **Core:** properties, property_media, locations, location_aliases, agents, enquiries,
  viewings, blog_posts, pages, testimonials, search_logs, settings
- **Phase 2:** users, favorites, saved_searches, notifications
- **Removed:** agencies, reviews, reports, subscriptions, transactions. Property
  documents become a private, access-controlled field on the property, not a public
  collection. Amenities/facilities/features/security-features (4 overlapping fields in
  the original brief) collapse into a single tagged taxonomy with categories.

### 8.2 Fields that must be correct for the Nigerian market

**Rent structure** — a single price field is insufficient:
`rent_amount`, `rent_period` (per annum is the Nigerian norm, not per month),
`advance_years`, `agency_fee_pct`, `legal_fee_pct`, `caution_deposit`,
`service_charge`, `service_charge_period`.

> **Lagos compliance:** Lagos State caps agency fees at 10% and bars demanding more
> than one year's rent in advance. A single price field risks publishing terms that
> breach both. Validation rules should be driven by a state-level table so other
> states can differ.

**Title and land** — enumerated field, not free text:
Certificate of Occupancy (C of O), Governor's Consent, Deed of Assignment, Registered
Survey, Excision (+ gazette number), Gazette, Family/customary land, Global Certificate
of Occupancy — plus `free_from_government_acquisition` flag and `survey_plan_available`.
Land quoted in plots/acres/hectares/sqm; a "plot" is not fixed size (~648 sqm generally,
~464 sqm in parts of Lagos). **Store square metres as the canonical unit**, convert for display.

**Infrastructure:**
- Power — grid band (A/B/C), generator, inverter, solar, estate-supplied 24-hour
- Water — borehole, well, public supply, treated
- Metering — prepaid or postpaid
- Flood risk/history (differentiating in Lekki, Ajah, VI)
- Road access — condition, distance to tarred road
- Estate — gated vs standalone, service charge frequency

**Retained from the original brief:** separate bathroom and toilet counts (Nigerian
listings quote both), and Boys' Quarters (BQ).

**Pricing presentation:**
- "Price on request" and "negotiable" are genuine states — handled correctly in sort/filter
- Currency stored per listing (high-end Lagos/Abuja stock often quoted in USD)
- Display as "₦150m" rather than "₦150,000,000"

## 9. Building it as a reusable template

> **Deviates deliberately from the source PDF.** The original §9 described a
> white-label *product* — one canonical repository deployed per client, differentiated
> by runtime config, with improvements flowing to all clients. That is **not** the model
> for this project. Rewritten below to match the actual intent.

**The model: this codebase is a template, not a product.** It is built for this client's
site first. When a second agency client comes along, the repo is **copied**, rebranded,
and becomes that client's own independent project. There is no shared runtime, no
canonical upstream, and no single app serving multiple clients' content from different
databases.

**A clean break is intended.** After a copy is made, the two codebases diverge freely.
Improvements are not backported automatically — if something from one client's build is
worth reusing, it gets carried over by hand, deliberately. The maintenance cost of
divergence is accepted as the trade for per-client freedom.

What that means for how this build is structured — none of it is about runtime
multi-tenancy, all of it is about making the copy-and-rebrand step fast:

- **Theme configuration in one place** — colours as CSS custom properties, font stack,
  logo, favicon, contact details, social links, footer copy. **No brand values hardcoded
  in components.** The point is that rebranding a fresh copy is editing one config
  source, not hunting through the component tree.
- **Content in the database, not in code** — homepage hero text, service descriptions,
  about copy. The reason here is client independence, not tenancy: each client's own
  staff edit their own copy without a developer or a deployment.
- **Clean module boundaries instead of feature flags** — short-let, off-plan, blog, AI
  search, saved searches should be separable enough that an unneeded module can simply be
  left unwired (or deleted) in a client's copy without unpicking core code. Runtime
  feature flags are *not* a requirement — a given deployment serves one client, and its
  feature set is decided at build time.
- **Seed script** — provisions a fresh copy with default pages, taxonomy, location data
  and placeholder content in minutes. This is the "start a new client project" step.
- **2–3 homepage layout variants** so client sites are visibly distinct — Nigerian
  agencies are competitive and will notice if a rival's site resembles theirs. In this
  model a variant is chosen when the copy is made, not toggled at runtime.

## 10. Technical recommendations (source doc)

> Recorded here as the scope doc's original recommendation. **This project's actual
> stack decision (Next.js + MongoDB/Mongoose, not Postgres) is documented in
> `CLAUDE.md` — that supersedes this section where they differ.**

- Next.js — SSR on listing/search pages (organic search is the entire acquisition channel)
- PostgreSQL + PostGIS — doc's recommendation for the relational/geo-heavy domain;
  doc notes Mongo is workable "if preferred, but the choice should be deliberate" —
  **this project has deliberately chosen MongoDB**
- No separate search engine — DB full-text search + indexed filters suffice for a few
  hundred listings; revisit only past tens of thousands
- Cloudinary for media
- Mapbox or Leaflet + OpenStreetMap (not Google Maps — avoids dollar-denominated per-view billing)
- Resend or Postmark for transactional email; Termii for OTP SMS in Phase 2 (rate-limited endpoint)
- WhatsApp click-to-chat links, not the Business API

### 10.2 Location data
Nigerian addresses geocode unreliably; many properties have no formal address. Don't
build search on top of a geocoder — the agent **drops a pin** on a map at listing time,
plus a required landmark field (e.g. "opposite Shoprite, Circle Mall").

### 10.3 Performance
Most traffic is mobile, metered data, mid-range Android, inconsistent connections —
treat as a functional requirement:
- Target <1MB per listing page incl. gallery: AVIF/WebP, responsive image sets, lazy
  loading below the fold, blurred placeholders
- Process images server-side on upload (agents upload 8MB phone photos)
- Chunked, resumable uploads (connections drop mid-upload)
- Cloudflare in front of the origin (no Nigerian AWS/GCP region)

### 10.4 Operational requirements
Staging + production environments, automated backups with tested restore, error
monitoring, uptime monitoring, CI pipeline.

## 11. Compliance and liability

- **Nigeria Data Protection Act 2023** — site collects enquirer PII. >200 data subjects
  in 6 months triggers NDPC registration category; penalties up to ₦10m or 2% of annual
  turnover. Privacy notice included in the build; NDPC registration is the client's
  contractual obligation.
- **Listing disclaimer** — every property page states the agency doesn't warrant title;
  buyers must conduct independent legal searches.
- **LASRERA registration** — client's obligation; display the registration number on
  the site as a trust signal (unregistered practice is an offence in Lagos).

Terms of use, privacy notice, and listing disclaimer should be reviewed by a Nigerian
lawyer before launch.

## 12. To confirm before quoting (open questions, not yet answered for this project)

- Agency or developer? (developer → off-plan module becomes core, not optional)
- How many listings exist today, and in what form (spreadsheet, WhatsApp photos, existing site)?
- Is short-let required? (separate quote, not a dropdown option)
- Do agents publish directly, or does admin approve first?
- Does the agency manage properties for landlords? (→ tenant portal upsell)
- Which states? (Lagos-only narrows compliance rules + location data)
- Domain/hosting/email accounts registered in whose name?
- Budget range, launch date, payment milestones?

## 13. Delivery summary

| Phase | Scope | Duration |
|---|---|---|
| Phase 1 | Full public site, admin panel, enquiry management, AI natural-language search, SEO foundation | 6–8 weeks |
| Phase 2 | Visitor accounts, saved searches, alerts, map search, agent dashboard | 3 weeks |
| Off-plan module | Developments, unit types, instalment payment plans | 2 weeks |
| Short-let module | Calendar, availability, booking | 3 weeks |
| Tenant portal | Rent schedules, maintenance requests, receipts | 3 weeks |
| Content migration | Per 50 listings | 2–4 days |

**Recurring costs** (client's own accounts, itemized, never absorbed into a naira fixed
price): hosting, CDN, email, mapping, AI search usage, SMS, domain renewal.

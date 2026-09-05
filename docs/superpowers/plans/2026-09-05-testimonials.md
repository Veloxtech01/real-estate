# Testimonials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `GET /api/testimonials` and wire the homepage's `Testimonials` component to it, deleting the fabricated placeholder quotes in `content/home.js`.

**Architecture:** A public read endpoint mirroring the `agents` API's shape (dedicated controller/route file, published-only, field whitelist). `Testimonials.jsx` moves from reading local placeholder content to accepting `{ eyebrow, title, items }` as props — its own existing comment already specifies this. No demo data is seeded; the section renders nothing until real testimonials exist in the database.

**Tech Stack:** Express 5 + Mongoose 9 (backend), Next.js 16 Server Components (frontend), Vitest + Testing Library + supertest + mongodb-memory-server for tests.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-09-05-testimonials-design.md`.
- **No seeded demo testimonials.** A testimonial is a first-person claim; inventing one — even for dev/demo purposes — is the exact misrepresentation problem this slice fixes. The endpoint legitimately returns `[]` until real ones exist.
- **Response envelope is `{ success: true, data }` / `{ success: false, message, details? }`.**
- **Public testimonial fields are an explicit inclusion whitelist**: `clientName, clientTitle, quote, photo, rating` — never `isPublished`, `displayOrder`, `agent`, or `property`.
- **`Testimonials.jsx` keeps its existing empty-state behavior**: `items.length === 0` (including the default `[]`) renders nothing, not an empty grid.
- **Comment every function/component per CLAUDE.md.**
- **Lint and test after every task:** backend — `cd backend && npm run lint && npm test`; frontend — `cd frontend && npm run lint && npm test`. Both must pass before committing that task.
- **No new dependencies.**

---

## File Structure

**Backend — created:** `backend/controllers/testimonialController.js`, `backend/routes/testimonialRoutes.js`, `backend/tests/api.testimonial.test.js`.
**Backend — modified:** `backend/app.js`, `docs/API-REFERENCE.md`.

**Frontend — created:** `frontend/src/components/home/Testimonials.test.jsx`.
**Frontend — modified:** `frontend/src/components/home/Testimonials.jsx`, `frontend/src/content/home.js`, `frontend/src/lib/api/server.js`, `frontend/src/app/(site)/page.js`.

**Docs — modified:** `CLAUDE.md`.

---

## Task 1: Public testimonials API (backend)

**Files:**
- Create: `backend/tests/api.testimonial.test.js`
- Create: `backend/controllers/testimonialController.js`
- Create: `backend/routes/testimonialRoutes.js`
- Modify: `backend/app.js`
- Modify: `docs/API-REFERENCE.md`

**Interfaces:**
- Consumes: `Testimonial` model (`backend/model/testimonialModel.js`).
- Produces: `GET /api/testimonials` → `{ success, data: { testimonials: [...] } }`, optionally capped with `?limit=`. Each testimonial has exactly: `_id, clientName, clientTitle, quote, photo, rating`.

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/api.testimonial.test.js`:

```js
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import Testimonial from "../model/testimonialModel.js";

/**
 * Public testimonials API (§3) — agency-curated client feedback, never a public
 * review system. Each test creates its own testimonials for isolation, same style
 * as api.agent.test.js.
 */
describe("Public testimonials API", () => {
  const app = createApp();

  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  /** Creates a published testimonial with sane defaults, overridable per test. */
  async function createTestimonial(overrides = {}) {
    return Testimonial.create({
      clientName: "Adaeze Okonkwo",
      clientTitle: "Buyer, Lekki",
      quote: "They confirmed the title before we ever booked a viewing.",
      isPublished: true,
      displayOrder: 0,
      ...overrides,
    });
  }

  it("returns only published testimonials, ordered by displayOrder", async () => {
    await createTestimonial({ clientName: "Second", displayOrder: 1 });
    await createTestimonial({ clientName: "First", displayOrder: 0 });
    await createTestimonial({
      clientName: "Hidden",
      isPublished: false,
      displayOrder: -1,
    });

    const response = await request(app).get("/api/testimonials");

    expect(response.status).toBe(200);
    expect(response.body.data.testimonials.map((t) => t.clientName)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("caps the result count with ?limit=", async () => {
    await createTestimonial({ clientName: "A", displayOrder: 0 });
    await createTestimonial({ clientName: "B", displayOrder: 1 });
    await createTestimonial({ clientName: "C", displayOrder: 2 });

    const response = await request(app).get("/api/testimonials?limit=2");

    expect(response.body.data.testimonials).toHaveLength(2);
  });

  it("never returns an unpublished testimonial regardless of displayOrder", async () => {
    await createTestimonial({
      clientName: "Unpublished",
      isPublished: false,
      displayOrder: 0,
    });

    const response = await request(app).get("/api/testimonials");

    expect(response.body.data.testimonials).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.testimonial.test.js`
Expected: FAIL — `/api/testimonials` does not exist yet, so every request 404s.

- [ ] **Step 3: Create `backend/controllers/testimonialController.js`**

```js
import Testimonial from "../model/testimonialModel.js";

/**
 * Public testimonials — agency-curated client feedback (§3). Not a public review
 * system: entries are staff-entered and there is no submission path (see the
 * model's own comment).
 *
 * An explicit inclusion whitelist keeps `isPublished`, `displayOrder`, `agent` and
 * `property` off this API — none of those are meant for public consumption.
 */
const PUBLIC_FIELDS = "clientName clientTitle quote photo rating";

/**
 * GET /api/testimonials — published testimonials, in curator-set order.
 *
 * Takes: (req, res); optional req.query.limit.
 * Returns: nothing; sends { success, data: { testimonials } }. An empty array is a
 *          legitimate answer — nothing has been curated yet — not an error.
 */
export async function listTestimonials(req, res) {
  const limit = Number(req.query.limit);

  let query = Testimonial.find({ isPublished: true })
    .select(PUBLIC_FIELDS)
    .sort({ displayOrder: 1 });

  // A non-numeric or non-positive limit is ignored rather than rejected — a stale
  // or malformed query param shouldn't cost the homepage its testimonials rail.
  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const testimonials = await query.lean();

  res.status(200).json({ success: true, data: { testimonials } });
}
```

- [ ] **Step 4: Create `backend/routes/testimonialRoutes.js`**

```js
import { Router } from "express";
import { listTestimonials } from "../controllers/testimonialController.js";

/** Public testimonials route (§3) — read-only, no submission path. */
const router = Router();
router.get("/", listTestimonials);

export default router;
```

- [ ] **Step 5: Mount the router in `backend/app.js`**

Add the import near the other route imports:

```js
import testimonialRoutes from "./routes/testimonialRoutes.js";
```

Add the mount line in the "Public read API" block, after `/api/agents`:

```js
  app.use("/api/agents", agentRoutes);
  app.use("/api/testimonials", testimonialRoutes);
  app.use("/api/filters", filterRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.testimonial.test.js`
Expected: PASS — all 3 tests green.

- [ ] **Step 7: Document the endpoint and close the "Not built yet" gap**

In `docs/API-REFERENCE.md`, insert a new section directly after the `## \`GET /api/agents\` · \`GET /api/agents/:slug\`` section (before the `---` that precedes `## GET /api/settings`):

```markdown
## `GET /api/testimonials`

Agency-curated client feedback (§3) — never a public review system; entries are
staff-entered and there is no submission path. Published only, in curator-set order.

`{ "testimonials": [{ "_id", "clientName", "clientTitle", "quote", "photo", "rating" }] }`.
`?limit=` caps the count. An empty array is a legitimate answer, not an error — the
homepage's `Testimonials` component renders nothing until at least one is curated.
```

Then find this line in the `## Not built yet` section:

```
No endpoints exist for: staff management, blog posts, pages, testimonials, or settings
updates. The **models exist** for all of them — only the routes and controllers are
missing. Don't build admin UI against these until the endpoints are written.
```

Replace with:

```
No endpoints exist for: staff management, blog posts, pages, or settings updates. The
**models exist** for all of them — only the routes and controllers are missing. Don't
build admin UI against these until the endpoints are written.
```

- [ ] **Step 8: Run the full backend suite and lint**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all tests pass (259 previous + 3 new = 262).

- [ ] **Step 9: Commit**

```bash
git add backend/controllers/testimonialController.js backend/routes/testimonialRoutes.js backend/app.js backend/tests/api.testimonial.test.js docs/API-REFERENCE.md
git commit -m "feat(backend): public testimonials API"
```

---

## Task 2: Wire the homepage to real testimonials

**Files:**
- Create: `frontend/src/components/home/Testimonials.test.jsx`
- Modify: `frontend/src/components/home/Testimonials.jsx`
- Modify: `frontend/src/content/home.js`
- Modify: `frontend/src/lib/api/server.js`
- Modify: `frontend/src/app/(site)/page.js`

**Interfaces:**
- Consumes: `GET /api/testimonials` (Task 1).
- Produces: `getTestimonials(limit)` — `revalidate: 300`, tag `"testimonials"`, returns `{ testimonials: [...] }` (the unwrapped `data`) or `null`. `<Testimonials eyebrow title items />` — `items` defaults to `[]`.

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/home/Testimonials.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Testimonials from "./Testimonials";

const items = [
  {
    _id: "1",
    clientName: "Adaeze Okonkwo",
    clientTitle: "Buyer, Lekki",
    quote: "They confirmed the title before we ever booked a viewing.",
  },
  {
    _id: "2",
    clientName: "Chidi Nwosu",
    clientTitle: "Tenant, Ikeja",
    quote: "The rent was quoted per annum with the advance stated up front.",
  },
];

describe("Testimonials", () => {
  it("renders a card per testimonial with the client's name, title and quote", () => {
    render(
      <Testimonials
        eyebrow="What our clients say"
        title="Trusted by discerning clients"
        items={items}
      />,
    );
    expect(screen.getByText("Adaeze Okonkwo")).toBeInTheDocument();
    expect(screen.getByText("Buyer, Lekki")).toBeInTheDocument();
    expect(screen.getByText(/confirmed the title/)).toBeInTheDocument();
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(
      <Testimonials eyebrow="x" title="y" items={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when items is omitted entirely", () => {
    const { container } = render(<Testimonials eyebrow="x" title="y" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/home/Testimonials.test.jsx`
Expected: FAIL — the current component reads `homeContent.testimonials` internally and ignores an `items` prop entirely, so it renders the three hardcoded placeholder quotes instead of (or in addition to) the test's own data, and the empty-items cases render the placeholder content instead of nothing.

- [ ] **Step 3: Rewrite `frontend/src/components/home/Testimonials.jsx`**

```jsx
import Section from "@/components/ui/Section";

/**
 * Client testimonials, three across on an ivory ground.
 *
 * `items` comes from GET /api/testimonials via the homepage server component — this
 * component holds no fallback content of its own. An empty rail reads as a fault, so
 * an empty or omitted `items` renders nothing rather than an empty grid; that is also
 * today's honest state until real testimonials are curated (see the design spec).
 *
 * No avatars: a stock headshot would be a photograph of someone who never said these
 * words. A name and a role carry the same layout weight without inventing a face.
 */
export default function Testimonials({ eyebrow, title, items = [] }) {
  if (items.length === 0) return null;

  return (
    <Section eyebrow={eyebrow} title={title} tone="raised">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          // <figure>/<blockquote>/<figcaption> is the correct structure for a quote
          // with an attribution — it is what carries the relationship to a screen reader.
          <figure
            key={item._id}
            className="flex h-full flex-col rounded-lg border border-border bg-surface p-7 transition-colors duration-200 hover:border-accent"
          >
            {/* Oversized gold quote mark. Decorative — the quote itself is the text,
                so this must not be read out as a stray character. */}
            <span
              className="font-display text-5xl leading-none text-accent"
              aria-hidden="true"
            >
              &ldquo;
            </span>

            <blockquote className="mt-4 flex-1 text-ink-soft">{item.quote}</blockquote>

            <figcaption className="mt-6 border-t border-border pt-5">
              <p className="font-medium text-ink">{item.clientName}</p>
              <p className="mt-0.5 text-sm text-muted">{item.clientTitle}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/home/Testimonials.test.jsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Delete the placeholder content from `frontend/src/content/home.js`**

Find this block (the entire comment plus the `testimonials` object):

```js
  /*
   * Testimonials.
   *
   * ⚠️ PLACEHOLDER COPY, written for layout. `testimonialModel` exists in the backend
   * but has no public endpoint yet; when one ships, this section reads from the API and
   * this block is deleted. Publishing invented client quotes under real names would be
   * a misrepresentation — replace before launch, do not simply rename.
   */
  testimonials: {
    eyebrow: "What our clients say",
    title: "Trusted by discerning clients",
    items: [
      {
        quote:
          "They confirmed the title before we ever booked a viewing. That alone saved us a wasted trip to a property that was never going to complete.",
        name: "Placeholder client",
        role: "Buyer, Lekki",
      },
      {
        quote:
          "One consultant handled the whole let, start to finish. No being passed around, no explaining myself twice.",
        name: "Placeholder client",
        role: "Landlord, Ikoyi",
      },
      {
        quote:
          "The rent was quoted per annum with the advance stated up front. It is the first time an agency has been that plain with me about the numbers.",
        name: "Placeholder client",
        role: "Tenant, Ikeja",
      },
    ],
  },
```

Replace with:

```js
  // Testimonials rail heading. The quotes themselves are real data from
  // GET /api/testimonials, not content — see components/home/Testimonials.jsx.
  testimonials: {
    eyebrow: "What our clients say",
    title: "Trusted by discerning clients",
  },
```

- [ ] **Step 6: Add `getTestimonials` to `frontend/src/lib/api/server.js`**

Add after `getSettings`:

```js
/**
 * Homepage testimonials rail. Legitimately returns an empty array until real
 * testimonials are curated (§3) — no seeded placeholder stands in for it.
 */
export function getTestimonials(limit = 6) {
  return request(`/testimonials?limit=${limit}`, {
    revalidate: 300,
    tags: ["testimonials"],
  });
}
```

- [ ] **Step 7: Wire the homepage**

In `frontend/src/app/(site)/page.js`, change the import line:

```js
import { getFeatured, getLocations, getFilters } from "@/lib/api/server";
```

to:

```js
import { getFeatured, getLocations, getFilters, getTestimonials } from "@/lib/api/server";
```

Change the data-fetching block:

```js
  const [featured, locations, filterOptions] = await Promise.all([
    getFeatured(6),
    getLocations(),
    getFilters(),
  ]);

  const properties = featured?.properties ?? [];
```

to:

```js
  const [featured, locations, filterOptions, testimonialsData] = await Promise.all([
    getFeatured(6),
    getLocations(),
    getFilters(),
    getTestimonials(6),
  ]);

  const properties = featured?.properties ?? [];
  const testimonials = testimonialsData?.testimonials ?? [];
```

Change the render call:

```jsx
      {/* Client quotes. Placeholder copy — see content/home.js. */}
      <Testimonials />
```

to:

```jsx
      {/* Client quotes — real data from GET /api/testimonials. Testimonials itself
          renders nothing when none have been curated yet; no placeholder fallback. */}
      <Testimonials
        eyebrow={homeContent.testimonials.eyebrow}
        title={homeContent.testimonials.title}
        items={testimonials}
      />
```

- [ ] **Step 8: Run the full frontend suite and lint**

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all tests pass (146 previous + 3 new = 149).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/home/Testimonials.jsx frontend/src/components/home/Testimonials.test.jsx frontend/src/content/home.js frontend/src/lib/api/server.js "frontend/src/app/(site)/page.js"
git commit -m "feat(frontend): wire homepage testimonials to the public API"
```

---

## Task 3: Documentation and final verification

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** None — this task only updates docs and runs verification across everything Tasks 1–2 built.

- [ ] **Step 1: Update the CLAUDE.md Status block**

Find this line:

```
> - **Marketing pages built** — `/about`, `/services`, `/team`, `/team/[slug]` and
>   `/contact`, closing the §3 gap. About/Services/Contact copy is hardcoded in
>   `src/content/`, matching `home.js`; Team is backed by a new public
>   `GET /api/agents` · `GET /api/agents/:slug` (public + active profiles only).
>   See the conventions note below before "fixing" this back toward `pageModel`.
```

Add directly after it:

```
> - **Homepage testimonials built** — `GET /api/testimonials` (published, curator-ordered,
>   `?limit=`) replaces the fabricated placeholder quotes that used to live in
>   `content/home.js`. No demo testimonials are seeded — see the design spec for why —
>   so the rail renders nothing on a fresh copy until real ones are curated by a direct
>   database write.
```

- [ ] **Step 2: Refresh the stale test-count line**

Find:

```
> - 255/255 backend tests and 140/140 frontend tests pass; both packages lint clean.
```

Replace with:

```
> - 262/262 backend tests and 149/149 frontend tests pass; both packages lint clean.
```

- [ ] **Step 3: Add the endpoint to the public endpoint table**

In the `## API endpoints (public, built)` table, insert a new row directly after the `/api/agents` row:

```
| GET    | `/api/testimonials`                       | Curated client feedback (§3), published + ordered only; `?limit=`             |
```

- [ ] **Step 4: Run both full test suites and lint**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all tests pass (262).

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all tests pass (149).

- [ ] **Step 5: Manual verification against a running app**

Start `cd backend && npm run dev` and `cd frontend && npm run dev`, then:

- [ ] `curl http://localhost:5000/api/testimonials` returns `{"success":true,"data":{"testimonials":[]}}` against the unseeded dev database — confirms the "no fabricated fallback" behavior for real
- [ ] The homepage's testimonials section is absent (not an empty grid) with zero curated testimonials
- [ ] Insert one testimonial directly in the database (e.g. via `mongosh` or Compass: `db.testimonials.insertOne({ clientName: "Test Client", clientTitle: "Buyer, Lekki", quote: "Manual verification quote.", isPublished: true, displayOrder: 0 })` against the dev database), then reload the homepage — the testimonials section now appears with that one card, correctly showing name/title/quote — then delete that document afterward so the dev database isn't left with fabricated content

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: testimonials status, endpoint table, and test-count refresh"
```

---

## Self-review notes

- **Spec coverage:** the backend endpoint, field whitelist, `?limit=`, `Testimonials.jsx` prop signature, `content/home.js` cleanup, and doc updates from the spec each map to a task/step above. The spec's "Deferred" items (admin CRUD, a standalone `/testimonials` page, star rendering, agent/property cross-linking) are intentionally not tasked.
- **Type/shape consistency check:** `getTestimonials()`'s `{testimonials: [...]}` matches the controller's `data.testimonials` key; `Testimonials.jsx`'s expected item shape (`_id, clientName, clientTitle, quote`) matches the `PUBLIC_FIELDS` projection plus Mongoose's implicit `_id`.
- **Stale-doc fix folded in:** `CLAUDE.md`'s test-count line was already out of date (255/140) from the marketing-pages slice landing at 259/146 without updating it — Task 3 corrects it to the final 262/149 rather than leaving it stale again.

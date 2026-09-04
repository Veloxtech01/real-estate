# Marketing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the five marketing routes the public site is missing — `/about`, `/services`, `/team`, `/team/[slug]`, `/contact` — plus a new public agents API and the nav/footer wiring to reach them.

**Architecture:** Marketing copy (About, Services, Contact) is hardcoded in `src/content/*.js`, matching the existing `home.js` pattern, not read from `pageModel`. The team roster is real structured data already in `agentModel`, so it is served through a new public `GET /api/agents` / `GET /api/agents/:slug` pair and rendered server-side, the same shape as every other public read in this codebase. All five pages are async Server Components using the existing `Section`/`Container`/`Button` primitives and the tone-alternation convention.

**Tech Stack:** Express 5 + Mongoose 9 (backend), Next.js 16 App Router + React 19 + Tailwind v4 (frontend), Vitest + Testing Library + supertest + mongodb-memory-server for tests.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-09-04-marketing-pages-design.md`. Every task below implements a piece of it — read it first if a task's rationale is unclear.
- **Response envelope is `{ success: true, data }` / `{ success: false, message, details? }`.** New endpoints must use it — no hand-rolled shape.
- **Public agent fields are an explicit inclusion whitelist**, never an exclusion list — a whitelist stays correct if a private field is added to `agentModel` later; an exclusion list does not.
- **A private, inactive, or unknown agent slug must 404 identically** — same rule already applied to draft/soft-deleted properties. Never leak which case it was.
- **No brand value, phone number, or address may be hardcoded in a component.** Contact details come from `siteConfig`; marketing copy comes from `src/content/*.js`. Neither lives inline in JSX.
- **`next/dynamic` with `ssr: false` is not allowed inside a Server Component.** Any new client-only widget (the office map) needs its own `"use client"` wrapper module — see Task 9.
- **Use `<Link>` for internal navigation, never a raw `<a href>`.** External/`tel:`/`mailto:`/`wa.me` links stay `<a>`.
- **Icons:** `react-icons/fi`, imported per icon, never the whole set.
- **Comment every function/component per CLAUDE.md** — what it does, non-obvious *why*, not what the code already says.
- **Lint and test after every task:** backend — `cd backend && npm run lint && npm test`; frontend — `cd frontend && npm run lint && npm test`. Both must pass before committing that task.
- **No new dependencies.** Everything needed (react-icons, react-hook-form, leaflet/react-leaflet, axios) is already installed.

---

## File Structure

**Backend — created:**

| Path | Responsibility |
| --- | --- |
| `backend/controllers/agentController.js` | `listAgents`, `getAgentBySlug` — public agent directory reads |
| `backend/routes/agentRoutes.js` | Mounts the two handlers at `/` and `/:slug` |
| `backend/tests/api.agent.test.js` | Integration tests for both endpoints |

**Backend — modified:** `backend/app.js` (mount `/api/agents`), `docs/API-REFERENCE.md`, `CLAUDE.md`, `docs/PROJECT-SCOPE.md`.

**Frontend — created:**

| Path | Responsibility |
| --- | --- |
| `frontend/src/content/about.js` | About-page copy |
| `frontend/src/content/services.js` | The six services' copy + hub CTA copy |
| `frontend/src/content/contact.js` | Contact-page heading/intro copy |
| `frontend/src/components/team/TeamCard.jsx` | Roster card — photo-less profile, call/WhatsApp, link to the profile page |
| `frontend/src/components/team/TeamCard.test.jsx` | Tests for the above |
| `frontend/src/components/contact/OfficeMap.jsx` | Client-only wrapper that dynamic-imports `MapCanvas` (Server Components can't) |
| `frontend/src/app/(site)/about/page.js` | About route |
| `frontend/src/app/(site)/services/page.js` | Services hub route |
| `frontend/src/app/(site)/team/page.js` | Team roster route |
| `frontend/src/app/(site)/team/[slug]/page.js` | Agent profile route |
| `frontend/src/app/(site)/contact/page.js` | Contact route |

**Frontend — modified:** `frontend/src/config/site.js` (new fields + nav/footer entries), `frontend/src/lib/api/server.js` (`getAgents`, `getAgent`), `frontend/src/components/forms/EnquiryForm.jsx` (generalized), `frontend/src/components/forms/EnquiryForm.test.jsx` (new cases added).

---

## Task 1: Public agents API (backend)

**Files:**
- Create: `backend/tests/api.agent.test.js`
- Create: `backend/controllers/agentController.js`
- Create: `backend/routes/agentRoutes.js`
- Modify: `backend/app.js`
- Modify: `docs/API-REFERENCE.md`

**Interfaces:**
- Consumes: `Agent` model (`backend/model/agentModel.js`), `ApiError` (`backend/utils/ApiError.js`).
- Produces: `GET /api/agents` → `{ success, data: { agents: [...] } }`; `GET /api/agents/:slug` → `{ success, data: { agent: {...} } }` or 404. Each agent object has exactly: `_id, name, slug, photo, position, bio, phone, whatsapp, registrationNumber, areas` (each area `{ _id, name, slug }`).

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/api.agent.test.js`:

```js
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import Agent from "../model/agentModel.js";

/**
 * Public agent API — the §3 "meet the team" directory and referral pages.
 *
 * Each test creates its own agents rather than sharing a seeded fixture: the
 * roster here is small, so per-test isolation is cheap and avoids tests
 * depending on each other's data (same style as agent.model.test.js).
 */
describe("Public agent API", () => {
  const app = createApp();

  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  /** Creates an agent with sane defaults, overridable per test. */
  async function createAgent(overrides = {}) {
    return Agent.create({
      name: "Adaeze Okonkwo",
      slug: "adaeze-okonkwo",
      email: "adaeze@example.com",
      password: "supersecret",
      phone: "+2348012345678",
      whatsapp: "2348012345678",
      position: "Senior Sales Consultant",
      isPublic: true,
      isActive: true,
      ...overrides,
    });
  }

  it("lists only public, active agents", async () => {
    await createAgent();
    await createAgent({
      name: "Private Agent",
      slug: "private-agent",
      email: "private@example.com",
      isPublic: false,
    });
    await createAgent({
      name: "Inactive Agent",
      slug: "inactive-agent",
      email: "inactive@example.com",
      isActive: false,
    });

    const response = await request(app).get("/api/agents");

    expect(response.status).toBe(200);
    expect(response.body.data.agents).toHaveLength(1);
    expect(response.body.data.agents[0].name).toBe("Adaeze Okonkwo");
  });

  it("never exposes email or password on the list or detail endpoint", async () => {
    await createAgent();

    const list = await request(app).get("/api/agents");
    expect(list.body.data.agents[0].email).toBeUndefined();
    expect(list.body.data.agents[0].password).toBeUndefined();

    const detail = await request(app).get("/api/agents/adaeze-okonkwo");
    expect(detail.body.data.agent.email).toBeUndefined();
    expect(detail.body.data.agent.password).toBeUndefined();
  });

  it("returns one agent by slug with name, position and contact numbers", async () => {
    await createAgent();

    const response = await request(app).get("/api/agents/adaeze-okonkwo");

    expect(response.status).toBe(200);
    expect(response.body.data.agent).toMatchObject({
      name: "Adaeze Okonkwo",
      slug: "adaeze-okonkwo",
      position: "Senior Sales Consultant",
      phone: "+2348012345678",
    });
  });

  it("404s identically for a private agent, an inactive agent, and an unknown slug", async () => {
    await createAgent({
      name: "Private Agent",
      slug: "private-agent",
      email: "private@example.com",
      isPublic: false,
    });
    await createAgent({
      name: "Inactive Agent",
      slug: "inactive-agent",
      email: "inactive@example.com",
      isActive: false,
    });

    const privateResponse = await request(app).get("/api/agents/private-agent");
    const inactiveResponse = await request(app).get("/api/agents/inactive-agent");
    const unknownResponse = await request(app).get("/api/agents/does-not-exist");

    expect(privateResponse.status).toBe(404);
    expect(inactiveResponse.status).toBe(404);
    expect(unknownResponse.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.agent.test.js`
Expected: FAIL — `/api/agents` does not exist yet, so every request 404s and `response.body.data` is undefined.

- [ ] **Step 3: Create `backend/controllers/agentController.js`**

```js
import Agent from "../model/agentModel.js";
import ApiError from "../utils/ApiError.js";

/**
 * Public agent directory — the §3 "meet the team" page and each agent's own
 * profile/referral landing page.
 *
 * An explicit inclusion whitelist (rather than excluding the private fields) is
 * what keeps `email`, `role`, `canPublish` and `lastLoginAt` off this API even if
 * a new private field is added to the model later — an exclusion list would leak
 * it by default.
 */
const PUBLIC_FIELDS = "name slug photo position bio phone whatsapp registrationNumber areas";

/**
 * GET /api/agents — the team roster.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { agents } }, public + active only.
 */
export async function listAgents(_req, res) {
  const agents = await Agent.find({ isPublic: true, isActive: true })
    .select(PUBLIC_FIELDS)
    .populate("areas", "name slug")
    .sort({ name: 1 })
    .lean();

  res.status(200).json({ success: true, data: { agents } });
}

/**
 * GET /api/agents/:slug — one agent's public profile.
 *
 * Takes: (req, res); req.params.slug.
 * Returns: nothing; sends { success, data: { agent } }.
 * Throws: ApiError 404 for a private agent, an inactive one, or an unknown slug —
 *         all three are indistinguishable, matching the rule already used for
 *         draft/soft-deleted properties (a different response would leak that a
 *         hidden record exists).
 */
export async function getAgentBySlug(req, res) {
  const agent = await Agent.findOne({
    slug: req.params.slug,
    isPublic: true,
    isActive: true,
  })
    .select(PUBLIC_FIELDS)
    .populate("areas", "name slug")
    .lean();

  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  res.status(200).json({ success: true, data: { agent } });
}
```

- [ ] **Step 4: Create `backend/routes/agentRoutes.js`**

```js
import { Router } from "express";
import { listAgents, getAgentBySlug } from "../controllers/agentController.js";

/** Public agent directory routes — team roster and individual profile pages (§3). */
const router = Router();
router.get("/", listAgents);
router.get("/:slug", getAgentBySlug);

export default router;
```

- [ ] **Step 5: Mount the router in `backend/app.js`**

Add the import near the other route imports:

```js
import agentRoutes from "./routes/agentRoutes.js";
```

Add the mount line in the "Public read API" block, after locations/taxonomy:

```js
  app.use("/api/properties", propertyRoutes);
  app.use("/api/locations", locationRouter);
  app.use("/api/taxonomy", taxonomyRouter);
  app.use("/api/agents", agentRoutes);
  app.use("/api/filters", filterRouter);
  app.use("/api/settings", settingsRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.agent.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 7: Document the endpoint**

In `docs/API-REFERENCE.md`, insert a new section directly after the `## \`GET /api/taxonomy\`` section (before the `---` that precedes `## GET /api/settings`):

```markdown
## `GET /api/agents` · `GET /api/agents/:slug`

Public team roster and per-agent profile/referral pages (§3). `isPublic && isActive`
only — a private or inactive agent 404s identically to an unknown slug.

- List: `{ "agents": [{ "_id", "name", "slug", "photo", "position", "bio", "phone",
  "whatsapp", "registrationNumber", "areas": [{ "_id", "name", "slug" }] }] }`.
- Detail: `{ "agent": { ...same shape } }`.
- Never exposes `email`, `password`, `role`, `canPublish`, or `lastLoginAt`.
```

- [ ] **Step 8: Run the full backend suite and lint**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all tests pass (255 previous + 4 new).

- [ ] **Step 9: Commit**

```bash
git add backend/controllers/agentController.js backend/routes/agentRoutes.js backend/app.js backend/tests/api.agent.test.js docs/API-REFERENCE.md
git commit -m "feat(backend): public agent directory API"
```

---

## Task 2: Site config additions

**Files:**
- Modify: `frontend/src/config/site.js`

**Interfaces:**
- Produces: `siteConfig.lasreraNumber` (string | null), `siteConfig.registrationNumbers` (`{body, number}[]`), `siteConfig.officeCoordinates` (`{lat: number, lng: number}`), four new entries in `siteConfig.nav`, and a new `"Company"` group in `siteConfig.footerLinks`. Tasks 5–9 read these.

This is a config-only change — there is no test to drive it; the exact content below is the specification (per the plan's own rules for config/schema tasks).

- [ ] **Step 1: Add the new fields to `siteConfig`**

Add directly below the existing `address`/`officeHours` block in `frontend/src/config/site.js`:

```js
  address: "1 Example Road, Lekki Phase 1, Lagos, Nigeria",
  officeHours: ["Mon – Fri: 9:00 – 18:00", "Sat: 10:00 – 16:00"],

  // Office pin for the contact page map. PLACEHOLDER coordinates (Lekki Phase 1,
  // approximate) — replace with the real office location before a client launch,
  // same status as the demo photography.
  officeCoordinates: { lat: 6.4415, lng: 3.4753 },

  // LASRERA number is a specific credential claim (scope §11) — left null rather
  // than a fabricated-looking placeholder, so the About page simply omits the line
  // until the client supplies the real one. Same reasoning as the homepage's
  // flagged placeholder stats: an invented-but-plausible number is worse than none.
  lasreraNumber: null,
  // Other professional body registrations, e.g. { body: "NIESV", number: "..." }.
  // Empty by default for the same reason lasreraNumber is null.
  registrationNumbers: [],
```

- [ ] **Step 2: Add the new nav entries**

Replace the existing `nav` array:

```js
  // Primary navigation. Routes not yet built are intentionally absent rather than
  // linking to a 404 — they get added with their slice.
  nav: [
    { href: "/properties?listingType=sale", label: "Buy" },
    { href: "/properties?listingType=rent", label: "Rent" },
    { href: "/properties", label: "All listings" },
  ],
```

with:

```js
  // Primary navigation. Routes not yet built are intentionally absent rather than
  // linking to a 404 — they get added with their slice.
  nav: [
    { href: "/properties?listingType=sale", label: "Buy" },
    { href: "/properties?listingType=rent", label: "Rent" },
    { href: "/properties", label: "All listings" },
    { href: "/services", label: "Services" },
    { href: "/team", label: "Our team" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],
```

- [ ] **Step 3: Add a "Company" footer column**

In the `footerLinks` array, add a new group (order: after "Property types"):

```js
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About us" },
        { href: "/services", label: "Services" },
        { href: "/team", label: "Meet the team" },
        { href: "/contact", label: "Contact" },
      ],
    },
```

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/config/site.js
git commit -m "feat(frontend): site config for marketing pages nav/footer/contact"
```

---

## Task 3: Generalize EnquiryForm

**Files:**
- Modify: `frontend/src/components/forms/EnquiryForm.jsx`
- Modify: `frontend/src/components/forms/EnquiryForm.test.jsx`

**Interfaces:**
- Consumes: `submitEnquiry` (`frontend/src/lib/api/client.js`, unchanged).
- Produces: `<EnquiryForm property? type="property_enquiry" source="property_page" heading="Enquire about this property" subheading="We usually reply the same working day." />` — all five props optional, defaults reproduce today's property-detail behaviour exactly. Task 9 (Contact page) calls this with `property` omitted and `type="general"` `source="contact_page"`.

- [ ] **Step 1: Write the two failing tests**

Add to the bottom of `frontend/src/components/forms/EnquiryForm.test.jsx` (inside the existing `describe("EnquiryForm", ...)` block, after the last `it`):

```jsx
  it("renders a custom heading and starts with an empty message when there is no property", () => {
    render(<EnquiryForm type="general" source="contact_page" heading="Send us a message" />);
    expect(screen.getByRole("heading", { name: "Send us a message" })).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toHaveValue("");
  });

  it("omits the property field and uses the passed type/source when no property is given", async () => {
    const user = userEvent.setup();
    submitEnquiry.mockResolvedValue({ id: "1" });
    render(<EnquiryForm type="general" source="contact_page" heading="Send us a message" />);

    await user.type(screen.getByLabelText(/your name/i), "Chidi Nwosu");
    await user.type(screen.getByLabelText(/phone/i), "+2348012345678");
    await user.click(screen.getByLabelText(/happy for us to contact you/i));
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalledTimes(1));
    const payload = submitEnquiry.mock.calls[0][0];
    expect(payload.type).toBe("general");
    expect(payload.source).toBe("contact_page");
    expect(payload).not.toHaveProperty("property");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/forms/EnquiryForm.test.jsx`
Expected: FAIL — the current component reads `property.reference` unconditionally in `defaultValues`, so rendering with no `property` prop throws a TypeError.

- [ ] **Step 3: Generalize the component**

Replace the function signature and the parts of `frontend/src/components/forms/EnquiryForm.jsx` shown below; everything else (the JSX for each field) is unchanged:

```jsx
/**
 * Lead capture — the conversion point of the entire site.
 *
 * Phone is required and email is not: phone is the primary contact channel in this
 * market. Contact consent is captured explicitly and marketing opt-in is a separate
 * checkbox, because agreeing to a callback is not agreeing to alerts (NDPA 2023,
 * scope §11).
 *
 * `property` is optional so the same form serves the property-detail page (defaults
 * below reproduce its exact prior behaviour) and a property-less enquiry like the
 * contact page, which passes `type="general"` and `source="contact_page"` instead.
 */
export default function EnquiryForm({
  property,
  type = "property_enquiry",
  source = "property_page",
  heading = "Enquire about this property",
  subheading = "We usually reply the same working day.",
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      // Only a property-page enquiry gets a pre-filled reference; a general
      // enquiry starts blank rather than referencing a listing that doesn't exist.
      message: property ? `I'd like more information about ${property.reference}.` : "",
      consentGiven: false,
      marketingOptIn: false,
    },
  });

  const onSubmit = async (values) => {
    try {
      await submitEnquiry({
        ...values,
        // The API resolves either a slug or an id; only sent when there is one.
        ...(property ? { property: property.slug } : {}),
        type,
        source,
      });
      toast.success("Thanks — we'll be in touch shortly.");
      reset();
    } catch (error) {
      // The interceptor normalised this: `details` is the API's field error map.
      if (error.details) {
        for (const [field, message] of Object.entries(error.details)) {
          setError(field, { type: "server", message });
        }
        return;
      }
      // No field map means a general failure (rate limit, outage) — say so once.
      toast.error(error.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-border bg-surface-raised p-6"
      noValidate
    >
      <h2 className="text-xl text-ink">{heading}</h2>
      <p className="mt-1 text-sm text-muted">{subheading}</p>
```

The rest of the JSX (name/phone/email/message fields, consent checkboxes, submit button) stays exactly as it is today — only the two lines above it (the `<h2>` and the `<p>`) change from hardcoded text to `{heading}` / `{subheading}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/forms/EnquiryForm.test.jsx`
Expected: PASS — all 6 tests (4 original + 2 new) green. The 4 original tests must pass **unmodified**, confirming the defaults reproduce prior behaviour exactly.

- [ ] **Step 5: Run the full frontend suite and lint**

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/forms/EnquiryForm.jsx frontend/src/components/forms/EnquiryForm.test.jsx
git commit -m "feat(frontend): generalize EnquiryForm for property-less enquiries"
```

---

## Task 4: TeamCard component

**Files:**
- Create: `frontend/src/components/team/TeamCard.test.jsx`
- Create: `frontend/src/components/team/TeamCard.jsx`

**Interfaces:**
- Consumes: an agent object shaped like the API response from Task 1 (`{_id, name, slug, position?, phone?, whatsapp?}` at minimum).
- Produces: `<TeamCard agent={agent} />`. Task 7 (Team list page) renders one per roster entry.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/team/TeamCard.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamCard from "./TeamCard";

// Vitest does not run the Next compiler — next/link needs stubbing, same as
// PropertyCard.test.jsx.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const agent = {
  _id: "1",
  slug: "adaeze-okonkwo",
  name: "Adaeze Okonkwo",
  position: "Senior Sales Consultant",
  phone: "+2348012345678",
  whatsapp: "2348012345678",
};

describe("TeamCard", () => {
  it("renders the agent's name and position", () => {
    render(<TeamCard agent={agent} />);
    expect(screen.getByText("Adaeze Okonkwo")).toBeInTheDocument();
    expect(screen.getByText("Senior Sales Consultant")).toBeInTheDocument();
  });

  it("links to the agent's own profile page", () => {
    render(<TeamCard agent={agent} />);
    expect(screen.getByRole("link", { name: /view profile/i })).toHaveAttribute(
      "href",
      "/team/adaeze-okonkwo",
    );
  });

  it("shows call and WhatsApp controls built from the agent's own numbers", () => {
    render(<TeamCard agent={agent} />);
    expect(screen.getByRole("link", { name: /call adaeze okonkwo/i })).toHaveAttribute(
      "href",
      "tel:+2348012345678",
    );
    expect(
      screen.getByRole("link", { name: /whatsapp adaeze okonkwo/i }),
    ).toHaveAttribute("href", expect.stringContaining("https://wa.me/2348012345678"));
  });

  it("omits call and WhatsApp controls when the agent has no numbers", () => {
    render(<TeamCard agent={{ ...agent, phone: undefined, whatsapp: undefined }} />);
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/team/TeamCard.test.jsx`
Expected: FAIL — `./TeamCard` does not exist.

- [ ] **Step 3: Create `frontend/src/components/team/TeamCard.jsx`**

```jsx
import Link from "next/link";
import { FiPhone, FiMessageCircle, FiUser } from "react-icons/fi";

/**
 * Team roster card — links to the agent's own profile/referral page (§3).
 *
 * Unlike AgentCard, this has no `property` context: the WhatsApp message is
 * generic and there is no listing reference line. No seeded demo agent has a
 * `photo` set, so — same as AgentCard — a neutral icon stands in rather than
 * building image-loading logic nothing exercises yet.
 */
export default function TeamCard({ agent }) {
  const whatsapp = agent.whatsapp?.replace(/\D/g, "");
  const whatsappMessage = encodeURIComponent(
    `Hello ${agent.name}, I'd like to talk to you about a property.`,
  );

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6 text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ink/5 text-muted"
        aria-hidden="true"
      >
        <FiUser size={32} />
      </div>

      <p className="mt-4 text-lg text-ink">{agent.name}</p>
      {agent.position && <p className="text-sm text-muted">{agent.position}</p>}

      <div className="mt-5 flex justify-center gap-3">
        {agent.phone && (
          <a
            href={`tel:${agent.phone}`}
            aria-label={`Call ${agent.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            <FiPhone size={17} aria-hidden="true" />
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`WhatsApp ${agent.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            <FiMessageCircle size={17} aria-hidden="true" />
          </a>
        )}
      </div>

      <Link
        href={`/team/${agent.slug}`}
        className="mt-5 inline-block text-sm text-accent-text hover:underline"
      >
        View profile
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/team/TeamCard.test.jsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Run the full frontend suite and lint**

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/team/TeamCard.jsx frontend/src/components/team/TeamCard.test.jsx
git commit -m "feat(frontend): TeamCard component"
```

---

## Task 5: About page

**Files:**
- Create: `frontend/src/content/about.js`
- Create: `frontend/src/app/(site)/about/page.js`

**Interfaces:**
- Consumes: `siteConfig.lasreraNumber`, `siteConfig.registrationNumbers` (Task 2); `Section` (`@/components/ui/Section`).
- Produces: the `/about` route.

No test drives this task — there is no `page.test.jsx` precedent anywhere in this codebase (Vitest doesn't run the Next compiler, so pages aren't unit-tested here; see CLAUDE.md). Verify by running the dev server in Task 10.

- [ ] **Step 1: Create `frontend/src/content/about.js`**

```js
/**
 * About-page copy (§3). Local to the repo rather than pageModel-backed — see the
 * design spec's content-source decision. Placeholder until the client supplies
 * their own history and credentials, same status as content/home.js.
 */
const aboutContent = {
  eyebrow: "Who we are",
  title: "About us",
  intro:
    "We handle residential and commercial sales, lettings and land across Nigeria — the kind of agency that verifies a title before it ever reaches a viewing.",
  story: {
    heading: "Our story",
    // PLACEHOLDER — replace with the agency's own history, years in operation and
    // what it is known for before this page goes live.
    body: "PLACEHOLDER — tell visitors how long you have been operating, the markets you specialise in, and what sets your service apart.",
  },
  values: {
    eyebrow: "How we work",
    title: "What you can expect",
    points: [
      {
        title: "Title verified before listing",
        body: "Every listing states its land title — C of O, Governor's Consent, excision or gazette — before it ever reaches a viewing.",
      },
      {
        title: "One consultant, start to finish",
        body: "The person who shows you a property is the one who takes it through to completion — no handoffs, no repeating yourself.",
      },
      {
        title: "Straightforward pricing",
        body: "Rent is quoted per annum with the advance stated up front, and our agency fees stay within the statutory limit in every state we operate.",
      },
    ],
  },
};

export default aboutContent;
```

- [ ] **Step 2: Create `frontend/src/app/(site)/about/page.js`**

```jsx
import { FiShield, FiUser, FiFileText } from "react-icons/fi";
import Section from "@/components/ui/Section";
import aboutContent from "@/content/about";
import siteConfig from "@/config/site";

// Positional icon set for the value points — same pattern as the homepage trust
// band's TRUST_ICONS (icons live in the page, not the content module).
const VALUE_ICONS = [FiShield, FiUser, FiFileText];

export const metadata = {
  title: `About us | ${siteConfig.name}`,
  description: aboutContent.intro,
};

/**
 * About page (§3) — agency story and credentials.
 *
 * Copy is local to content/about.js rather than pageModel-backed (see the design
 * spec's content-source decision) — same placeholder-until-launch status as
 * home.js.
 */
export default function AboutPage() {
  const hasCredentials =
    Boolean(siteConfig.lasreraNumber) || siteConfig.registrationNumbers.length > 0;

  return (
    <>
      <Section
        eyebrow={aboutContent.eyebrow}
        title={aboutContent.title}
        tone="dark"
        centered
      >
        <p className="mx-auto max-w-[68ch] text-center text-white/80">
          {aboutContent.intro}
        </p>
      </Section>

      <Section title={aboutContent.story.heading} tone="light">
        <p className="max-w-[68ch] whitespace-pre-line text-ink-soft">
          {aboutContent.story.body}
        </p>

        {/* Credentials shown only when configured — an absent one must not render
            as an empty claim (same reasoning as siteConfig.lasreraNumber being
            null rather than a placeholder-looking string). */}
        {hasCredentials && (
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
            {siteConfig.lasreraNumber && <span>LASRERA: {siteConfig.lasreraNumber}</span>}
            {siteConfig.registrationNumbers.map((reg) => (
              <span key={reg.body}>
                {reg.body}: {reg.number}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section
        eyebrow={aboutContent.values.eyebrow}
        title={aboutContent.values.title}
        tone="dark"
      >
        <div className="grid gap-10 md:grid-cols-3">
          {aboutContent.values.points.map((point, index) => {
            const Icon = VALUE_ICONS[index % VALUE_ICONS.length];
            return (
              <div key={point.title}>
                <div
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-xl text-white">{point.title}</h3>
                <p className="mt-3 max-w-[42ch] text-white/70">{point.body}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
```

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/content/about.js "frontend/src/app/(site)/about/page.js"
git commit -m "feat(frontend): about page"
```

---

## Task 6: Services hub page

**Files:**
- Create: `frontend/src/content/services.js`
- Create: `frontend/src/app/(site)/services/page.js`

**Interfaces:**
- Consumes: `Section`, `Button` (`@/components/ui`).
- Produces: the `/services` route. One hub page, not six — see the design spec's services-scope decision and the `docs/PROJECT-SCOPE.md` §3 deviation note (Task 10).

No test drives this task — same reasoning as Task 5. Verify via the dev server in Task 10.

- [ ] **Step 1: Create `frontend/src/content/services.js`**

```js
/**
 * Services-hub copy (§3). One page covering all six services rather than six
 * individual pages — see the design spec's services-scope decision.
 */
const servicesContent = {
  eyebrow: "What we do",
  title: "Property services",
  description: "From a first sale to ongoing management, one team handles it end to end.",
  items: [
    {
      slug: "sales",
      title: "Sales",
      blurb:
        "Verified listings for buyers, and a managed process for sellers — from valuation to closing.",
      href: "/properties?listingType=sale",
    },
    {
      slug: "lettings",
      title: "Lettings",
      blurb:
        "Tenant sourcing, referencing and lease paperwork, with rent quoted per annum and agency fees within the statutory limit.",
      href: "/properties?listingType=rent",
    },
    {
      slug: "property-management",
      title: "Property management",
      blurb:
        "Day-to-day management of tenanted property on the owner's behalf — rent collection, maintenance and tenant relations.",
      href: "/contact",
    },
    {
      slug: "facility-management",
      title: "Facility management",
      blurb:
        "Upkeep of shared infrastructure, security and services across an estate or a commercial building.",
      href: "/contact",
    },
    {
      slug: "valuation",
      title: "Valuation",
      blurb: "An independent opinion of value for a sale, a loan application, or your own records.",
      href: "/contact",
    },
    {
      slug: "land-banking",
      title: "Land banking",
      blurb: "Acquisition of titled land for long-term holding, with title verification handled up front.",
      href: "/contact",
    },
  ],
  cta: {
    title: "Not sure which service you need?",
    body: "Tell us what you're trying to do and we'll point you the right way.",
    action: "Get in touch",
  },
};

export default servicesContent;
```

- [ ] **Step 2: Create `frontend/src/app/(site)/services/page.js`**

```jsx
import { FiHome, FiKey, FiClipboard, FiTool, FiTrendingUp, FiMap } from "react-icons/fi";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import servicesContent from "@/content/services";
import siteConfig from "@/config/site";

// Positional icon set, one per entry in servicesContent.items — same pattern as
// the homepage trust band's TRUST_ICONS.
const SERVICE_ICONS = [FiHome, FiKey, FiClipboard, FiTool, FiTrendingUp, FiMap];

export const metadata = {
  title: `Services | ${siteConfig.name}`,
  description: servicesContent.description,
};

/**
 * Services hub (§3) — one page covering all six services rather than six
 * individual pages; see the design spec's services-scope decision.
 */
export default function ServicesPage() {
  return (
    <>
      <Section
        eyebrow={servicesContent.eyebrow}
        title={servicesContent.title}
        description={servicesContent.description}
        tone="dark"
        centered
      />

      <Section tone="light">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {servicesContent.items.map((service, index) => {
            const Icon = SERVICE_ICONS[index % SERVICE_ICONS.length];
            return (
              <div
                key={service.slug}
                className="rounded-lg border border-border bg-surface-raised p-6"
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent-text ring-1 ring-accent/30"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-xl text-ink">{service.title}</h3>
                <p className="mt-3 text-ink-soft">{service.blurb}</p>
                <Button href={service.href} variant="ghost" className="mt-5">
                  Learn more
                </Button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section tone="dark" centered>
        <h2 className="text-3xl text-white md:text-4xl">{servicesContent.cta.title}</h2>
        <p className="mx-auto mt-4 max-w-[56ch] text-white/70">{servicesContent.cta.body}</p>
        <div className="mt-8 flex justify-center">
          <Button href="/contact" variant="accent" size="lg">
            {servicesContent.cta.action}
          </Button>
        </div>
      </Section>
    </>
  );
}
```

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/content/services.js "frontend/src/app/(site)/services/page.js"
git commit -m "feat(frontend): services hub page"
```

---

## Task 7: Team roster page

**Files:**
- Modify: `frontend/src/lib/api/server.js`
- Create: `frontend/src/app/(site)/team/page.js`

**Interfaces:**
- Consumes: `GET /api/agents` (Task 1); `TeamCard` (Task 4); `Section`.
- Produces: `getAgents()` — `revalidate: 3600`, tag `"agents"`, returns `{ agents: [...] }` (the unwrapped `data`) or `null`. The `/team` route.

No test drives this task, same reasoning as Task 5. Verify via the dev server in Task 10, against the 8 seeded demo agents.

- [ ] **Step 1: Add `getAgents` to `frontend/src/lib/api/server.js`**

Add after `getSettings`:

```js
/** Public team roster (§3). */
export function getAgents() {
  return request("/agents", { revalidate: 3600, tags: ["agents"] });
}
```

- [ ] **Step 2: Create `frontend/src/app/(site)/team/page.js`**

```jsx
import Section from "@/components/ui/Section";
import TeamCard from "@/components/team/TeamCard";
import { getAgents } from "@/lib/api/server";
import siteConfig from "@/config/site";

export const metadata = {
  title: `Meet the team | ${siteConfig.name}`,
  description: "The consultants behind every listing.",
};

/**
 * Team roster (§3) — trust signals and the entry point to each agent's own
 * profile/referral page.
 */
export default async function TeamPage() {
  const data = await getAgents();
  const agents = data?.agents ?? [];

  return (
    <Section eyebrow="Meet the team" title="The people behind every listing" tone="light">
      {agents.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <TeamCard key={agent._id} agent={agent} />
          ))}
        </div>
      ) : (
        // An empty roster must not render as a broken grid — the seed always
        // produces public agents, but a fresh client copy might not yet.
        <p className="text-ink-soft">Our team profiles will be here shortly — call us in the meantime.</p>
      )}
    </Section>
  );
}
```

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api/server.js "frontend/src/app/(site)/team/page.js"
git commit -m "feat(frontend): team roster page"
```

---

## Task 8: Agent profile page

**Files:**
- Modify: `frontend/src/lib/api/server.js`
- Create: `frontend/src/app/(site)/team/[slug]/page.js`

**Interfaces:**
- Consumes: `GET /api/agents/:slug` (Task 1).
- Produces: `getAgent(slug)` — `revalidate: 3600`, tags `["agents", "agent:<slug>"]`, returns `{ agent: {...} }` or `null` on 404. The `/team/[slug]` route, `notFound()` on null.

No test drives this task, same reasoning as Task 5. Verify via the dev server in Task 10: one seeded agent's slug should render, and `/team/does-not-exist` should 404.

- [ ] **Step 1: Add `getAgent` to `frontend/src/lib/api/server.js`**

Add directly after `getAgents`:

```js
/** One agent's public profile, by slug. Null on 404 (private, inactive, or unknown). */
export function getAgent(slug) {
  return request(`/agents/${encodeURIComponent(slug)}`, {
    revalidate: 3600,
    tags: ["agents", `agent:${slug}`],
  });
}
```

- [ ] **Step 2: Create `frontend/src/app/(site)/team/[slug]/page.js`**

```jsx
import { notFound } from "next/navigation";
import { FiPhone, FiMessageCircle } from "react-icons/fi";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { getAgent } from "@/lib/api/server";

/** Next 16: params is a Promise. A missing/private/inactive agent gets generic metadata. */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getAgent(slug);
  if (!data?.agent) return { title: "Agent not found" };
  return {
    title: data.agent.name,
    description: data.agent.bio || `Get in touch with ${data.agent.name}.`,
  };
}

/**
 * Agent profile — the §3 referral landing page.
 *
 * Call/WhatsApp only, deliberately — a property-less enquiry form here needs
 * `createEnquiry` to accept an `agent` id directly, which it does not yet (see the
 * design spec's Deferred section). Adding that is a backend change, not this task.
 */
export default async function AgentProfilePage({ params }) {
  const { slug } = await params;
  const data = await getAgent(slug);

  // A private, inactive, or unknown slug all resolve to the same null here,
  // and must all 404 identically — no response may leak which case it was.
  if (!data?.agent) notFound();

  const { agent } = data;
  const whatsapp = agent.whatsapp?.replace(/\D/g, "");
  const whatsappMessage = encodeURIComponent(
    `Hello ${agent.name}, I'd like to talk to you about a property.`,
  );

  return (
    <Container className="py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl text-ink md:text-4xl">{agent.name}</h1>
        {agent.position && <p className="mt-2 text-ink-soft">{agent.position}</p>}
        {agent.areas?.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Covers {agent.areas.map((area) => area.name).join(", ")}
          </p>
        )}
        {agent.bio && <p className="mt-6 max-w-[60ch] text-ink-soft">{agent.bio}</p>}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {agent.phone && (
            <Button href={`tel:${agent.phone}`} size="lg">
              <FiPhone size={16} aria-hidden="true" />
              Call {agent.phone}
            </Button>
          )}
          {whatsapp && (
            <Button
              href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
              variant="secondary"
              size="lg"
            >
              <FiMessageCircle size={16} aria-hidden="true" />
              WhatsApp
            </Button>
          )}
        </div>
      </div>
    </Container>
  );
}
```

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api/server.js "frontend/src/app/(site)/team/[slug]/page.js"
git commit -m "feat(frontend): agent profile page"
```

---

## Task 9: Contact page

**Files:**
- Create: `frontend/src/content/contact.js`
- Create: `frontend/src/components/contact/OfficeMap.jsx`
- Create: `frontend/src/app/(site)/contact/page.js`

**Interfaces:**
- Consumes: `siteConfig.phone/email/address/officeHours/officeCoordinates` (Task 2); the generalized `EnquiryForm` (Task 3); `MapCanvas` (`@/components/property/MapCanvas`, unchanged).
- Produces: the `/contact` route.

No test drives this task, same reasoning as Task 5. Verify via the dev server in Task 10 — including an actual enquiry submission with `type: general, source: contact_page` visible in the network tab or backend logs.

- [ ] **Step 1: Create `frontend/src/content/contact.js`**

```js
/** Contact-page copy (§3). Office details themselves live in config/site.js. */
const contactContent = {
  eyebrow: "Get in touch",
  title: "Contact us",
  intro: "Call, WhatsApp, or send a message below — we usually reply the same working day.",
};

export default contactContent;
```

- [ ] **Step 2: Create `frontend/src/components/contact/OfficeMap.jsx`**

```jsx
"use client";

import dynamic from "next/dynamic";

/**
 * Client-only wrapper around MapCanvas for the office pin.
 *
 * Next.js forbids `ssr: false` on `next/dynamic` inside a Server Component — the
 * contact page itself is one, so this thin wrapper exists purely to hold the
 * dynamic import. PropertyMap.jsx does the same thing for listing pins, for the
 * same reason.
 */
const MapCanvas = dynamic(() => import("@/components/property/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-ink/5" />,
});

export default function OfficeMap({ lat, lng, landmark, title }) {
  return <MapCanvas lat={lat} lng={lng} landmark={landmark} title={title} />;
}
```

- [ ] **Step 3: Create `frontend/src/app/(site)/contact/page.js`**

```jsx
import { FiPhone, FiMail, FiMapPin, FiClock } from "react-icons/fi";
import Section from "@/components/ui/Section";
import EnquiryForm from "@/components/forms/EnquiryForm";
import OfficeMap from "@/components/contact/OfficeMap";
import contactContent from "@/content/contact";
import siteConfig from "@/config/site";

export const metadata = {
  title: `Contact us | ${siteConfig.name}`,
  description: contactContent.intro,
};

/**
 * Contact page (§3). Office details come from config/site.js — the established
 * source for this build (see lib/api/server.js's getSettings comment) — not a
 * fresh /api/settings read.
 */
export default function ContactPage() {
  return (
    <Section
      eyebrow={contactContent.eyebrow}
      title={contactContent.title}
      description={contactContent.intro}
      tone="light"
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        {/* Office details + map */}
        <div className="space-y-8">
          <div className="space-y-4 text-ink-soft">
            <a href={`tel:${siteConfig.phone}`} className="flex items-start gap-3 hover:text-ink">
              <FiPhone size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
              {siteConfig.phone}
            </a>
            <a
              href={`mailto:${siteConfig.email}`}
              className="flex items-start gap-3 hover:text-ink"
            >
              <FiMail size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
              {siteConfig.email}
            </a>
            <p className="flex items-start gap-3">
              <FiMapPin size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
              {siteConfig.address}
            </p>
            {siteConfig.officeHours.length > 0 && (
              <div className="flex items-start gap-3">
                <FiClock size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
                <div>
                  {siteConfig.officeHours.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <OfficeMap
            lat={siteConfig.officeCoordinates.lat}
            lng={siteConfig.officeCoordinates.lng}
            landmark={siteConfig.address}
            title={siteConfig.name}
          />
        </div>

        {/* General enquiry — no property attached */}
        <EnquiryForm
          type="general"
          source="contact_page"
          heading="Send us a message"
          subheading="Tell us what you're looking for and we'll get back to you."
        />
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/content/contact.js frontend/src/components/contact/OfficeMap.jsx "frontend/src/app/(site)/contact/page.js"
git commit -m "feat(frontend): contact page"
```

---

## Task 10: Documentation and final verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/PROJECT-SCOPE.md`

**Interfaces:** None — this task only updates docs and runs verification across everything Tasks 1–9 built.

- [ ] **Step 1: Update the CLAUDE.md Status block**

Find this line (under "Not built:"):

```
> - **Not built:** staff management, blog editor, settings admin, the
>   §4.3 daily digest — plus neighbourhood/agent pages, marketing pages and blog on
>   the frontend.
```

Replace with:

```
> - **Marketing pages built** — `/about`, `/services`, `/team`, `/team/[slug]` and
>   `/contact`, closing the §3 gap. About/Services/Contact copy is hardcoded in
>   `src/content/`, matching `home.js`; Team is backed by a new public
>   `GET /api/agents` · `GET /api/agents/:slug` (public + active profiles only).
>   See the conventions note below before "fixing" this back toward `pageModel`.
> - **Not built:** staff management, blog editor, settings admin, the
>   §4.3 daily digest — plus neighbourhood pages and blog on the frontend.
```

- [ ] **Step 2: Add the endpoint to the public endpoint table**

In the `## API endpoints (public, built)` table, insert a new row directly after the `/api/taxonomy` row:

```
| GET    | `/api/agents` · `/api/agents/:slug`       | Public team roster and profile pages (§3); `isPublic && isActive` only |
```

- [ ] **Step 3: Add a conventions note under "Public site look and feel"**

Add as a new bullet at the end of that bullet list:

```
- **Marketing-page copy (About/Services/Contact) is hardcoded in `src/content/`,
  same as the homepage — not `pageModel`-backed.** `pageModel` exists and is
  seeded, but nothing reads it and there is no admin editor to change it yet;
  building that read path was out of scope for the marketing-pages slice. This is
  a deliberate, discussed deviation from §9's DB-content preference — see
  `docs/PROJECT-SCOPE.md` §9 and
  `docs/superpowers/specs/2026-09-04-marketing-pages-design.md`. Team is the one
  exception: `agentModel` is real structured data, so it is served from a public
  API instead of being duplicated into a content file.
```

- [ ] **Step 4: Add the §3 deviation note to `docs/PROJECT-SCOPE.md`**

Directly after the §3 bullet list (before `## 4. Phase 1`), add:

```markdown
> **Services narrowed to one hub page, deliberately.** This bullet describes six
> separate service pages/SEO entry points. The 2026-09-04 marketing-pages slice
> ships one `/services` hub page with a section per service instead — six pages of
> invented placeholder copy serves nobody, and individual `/services/[slug]` pages
> are a straightforward follow-up once there is real copy to put on them. See
> `docs/superpowers/specs/2026-09-04-marketing-pages-design.md`.
```

- [ ] **Step 5: Add the §9 deviation note to `docs/PROJECT-SCOPE.md`**

Directly after the "Content in the database, not in code" bullet in §9, add:

```markdown
> **Deviates in practice, so far.** Homepage copy (`content/home.js`) and, as of
> the 2026-09-04 marketing-pages slice, About/Services/Contact copy are hardcoded
> in `src/content/` rather than read from `pageModel`, even though the model
> exists and is seeded for exactly this. The gap is that nothing reads it and
> there is no admin editor to change it — building that pipeline was out of scope
> for both slices. Team is the one page in this set that IS DB-backed
> (`GET /api/agents`), because a roster is structured business data, not
> marketing copy. This bullet's intent still holds as the target; `pageModel` plus
> a content editor is the natural next slice to actually deliver it.
```

- [ ] **Step 6: Run both full test suites and lint**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all tests pass (255 + 4 new = 259).

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all tests pass (140 + 2 new EnquiryForm cases + 4 new TeamCard cases = 146).

- [ ] **Step 7: Production build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no type/import errors. `/about`, `/services`, `/team` and `/contact` should be static or server-rendered as appropriate; `/team/[slug]` server-rendered (`ƒ`) since it depends on request data.

- [ ] **Step 8: Manual verification against a running app**

Start `cd backend && npm run dev` and `cd frontend && npm run dev`, then in a browser:

- [ ] Header and footer show About, Services, Our team, Contact links on every page, and none 404
- [ ] `/about` renders; the LASRERA/registration line is absent (both are unset placeholders)
- [ ] `/services` renders all six services; Sales/Lettings links land on `/properties` pre-filtered by listing type
- [ ] `/team` renders the 8 seeded demo agents as cards
- [ ] Clicking "View profile" opens `/team/<slug>` with that agent's name, position, call/WhatsApp buttons
- [ ] `/team/does-not-exist` renders the site's 404 page
- [ ] `/contact` renders office details, the office map pin, and the enquiry form; submitting it (with consent checked) shows the success toast
- [ ] No horizontal scroll and no layout shift at 375 / 768 / 1440px on any of the five pages
- [ ] Keyboard-tabbing through each page keeps a visible focus ring throughout, including inside the navy header/footer

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md docs/PROJECT-SCOPE.md
git commit -m "docs: marketing pages status, endpoint table, and deviation notes"
```

---

## Self-review notes

- **Spec coverage:** every File Structure entry in the spec (agents API, content files, `TeamCard`, `EnquiryForm` generalization, five pages, nav/footer, docs) maps to a task above. The spec's "Deferred" items (agent-page enquiry form, `/services/[slug]` pages, `pageModel` content, settings-API contact details) are intentionally not tasked.
- **Caught during planning:** the original draft had the Contact page call `next/dynamic(..., { ssr: false })` directly inside the (Server Component) page, which Next.js rejects — fixed by extracting `OfficeMap.jsx` as its own `"use client"` wrapper (Task 9), mirroring how `PropertyMap.jsx` already solves this for listings.
- **Type/shape consistency check:** `getAgents()`/`getAgent()` response shapes (`{agents: [...]}`, `{agent: {...}}`) match the backend controller's `data.agents`/`data.agent` keys exactly; `TeamCard`'s expected agent shape (`name, slug, position?, phone?, whatsapp?, _id`) matches the `PUBLIC_FIELDS` projection plus Mongoose's implicit `_id`.

# Lead Operations API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the enquiry inbox and viewing management endpoints so staff can see and action the leads the public site already captures.

**Architecture:** Two new admin routers under `/api/admin`, following the existing `adminPropertyRoutes` pattern exactly — `router.use(requireAuth)`, per-route `authorizeRole("administrator")` on destructive actions, `WRITABLE_FIELDS` allow-listing on updates, and the `{ success, data }` envelope. Ownership scoping and the viewing state machine are extracted into separately testable modules rather than living inline in controllers.

**Tech Stack:** Express 5, Mongoose 9, ESM. Tests: Vitest + supertest + mongodb-memory-server. No new dependencies.

## Global Constraints

- **Response envelope:** success `{ success: true, data: {...} }`; failure `{ success: false, message, details? }`. Never hand-roll another shape.
- **Throw `new ApiError(status, message)`** from `utils/ApiError.js` rather than `res.status().json()` on a failure path. Express 5 forwards async throws automatically — **no try/catch wrapper, no `express-async-handler`**.
- **Mongoose `ValidationError`/`CastError`/11000 are already translated** to 400/400/409 in `middleware/errorHandler.js`. Do not re-handle them per controller.
- **Never inline a controlled value list.** Every enum comes from `utils/constants.js` — `ENQUIRY_STATUSES`, `ENQUIRY_TYPES`, `ENQUIRY_SOURCES`, `VIEWING_STATUSES`.
- **Mongoose 9:** `pre`/`post` hooks take no `next()` callback and must be `async`.
- **Every function, controller, middleware and non-obvious branch gets a comment** explaining *why*, per CLAUDE.md.
- **ESM** — `import`, not `require`. Relative imports carry the `.js` extension.
- **`notes` is `select: false`** on both models. It must stay out of list responses and be explicitly selected on detail responses.
- **Ownership violations return 403**, matching `canManageProperty` in `adminPropertyController`. (The *public* surface still 404s to avoid leaking existence — that rule is unchanged and does not apply here.)
- **Pagination:** `page` defaults 1; `limit` defaults 20, capped at 100. Same as `listAdminProperties`.
- **Lint and test after every task:** `npm run lint` and `npm test` inside `backend/` must both pass before committing.
- Spec: `docs/superpowers/specs/2026-09-04-lead-operations-api-design.md`.

### Run commands

```bash
cd backend
npm run lint          # eslint, flat config
npm test              # vitest run (134 tests currently passing)
npx vitest run tests/<file>   # a single suite
```

---

## File Structure

**Create:**

| Path | Responsibility |
| --- | --- |
| `backend/utils/escapeRegex.js` | Escape user input before it reaches a `RegExp` |
| `backend/utils/viewingTransitions.js` | The viewing state machine, standalone |
| `backend/controllers/adminEnquiryController.js` | List, stats, detail, update, delete |
| `backend/controllers/adminViewingController.js` | List, detail, update, delete |
| `backend/routes/adminEnquiryRoutes.js` | Mount + per-route authorisation |
| `backend/routes/adminViewingRoutes.js` | Mount + per-route authorisation |
| `backend/emails/viewingEmails.js` | Viewing templates, incl. the two moved out of `enquiryEmails.js` |
| `backend/tests/viewingTransitions.test.js` | State machine unit tests |
| `backend/tests/api.adminEnquiry.test.js` | Route-level tests |
| `backend/tests/api.adminViewing.test.js` | Route-level tests |

**Modify:**

| Path | Change |
| --- | --- |
| `backend/middleware/auth.js` | Add `scopeLeadQuery`, `canManageLead` |
| `backend/controllers/adminPropertyController.js` | Use `escapeRegex` instead of two inline escapes |
| `backend/emails/enquiryEmails.js` | Remove the two viewing templates |
| `backend/controllers/enquiryController.js` | Update the import for the moved templates |
| `backend/app.js` | Mount the two new routers |
| `docs/API-REFERENCE.md` | Document the endpoints; shrink "Not built yet" |
| `CLAUDE.md` | Update the status block and endpoint tables |

---

## Task 1: Regex escaping helper

`adminPropertyController.js` currently inlines the same escape twice. Extracting it is a
prerequisite for the enquiry `q` search, which needs the same thing on three fields.

**Files:**
- Create: `backend/utils/escapeRegex.js`
- Create: `backend/tests/escapeRegex.test.js`
- Modify: `backend/controllers/adminPropertyController.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `escapeRegex(input: string) => string`, and `buildSearchRegex(input: string) => RegExp` (case-insensitive, escaped).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/escapeRegex.test.js`:

```js
import { describe, it, expect } from "vitest";
import { escapeRegex, buildSearchRegex } from "../utils/escapeRegex.js";

describe("escapeRegex", () => {
  it("leaves ordinary text alone", () => {
    expect(escapeRegex("Lekki Phase 1")).toBe("Lekki Phase 1");
  });

  it("escapes every regex metacharacter", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    );
  });

  it("returns an empty string for a nullish input", () => {
    expect(escapeRegex(undefined)).toBe("");
    expect(escapeRegex(null)).toBe("");
  });
});

describe("buildSearchRegex", () => {
  it("matches case-insensitively", () => {
    expect(buildSearchRegex("lekki").test("Lekki Phase 1")).toBe(true);
  });

  it("treats a metacharacter as a literal rather than a pattern", () => {
    // Without escaping this matches everything, which is both wrong and a ReDoS risk.
    expect(buildSearchRegex(".*").test("anything")).toBe(false);
    expect(buildSearchRegex(".*").test("literally .* here")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/escapeRegex.test.js`
Expected: FAIL — cannot resolve `../utils/escapeRegex.js`.

- [ ] **Step 3: Write the implementation**

Create `backend/utils/escapeRegex.js`:

```js
/**
 * Regex-safety helpers for user-supplied search terms.
 *
 * Every staff-facing search here builds a RegExp from something a person typed. Without
 * escaping, a term like ".*" matches every document, and a pathological term can pin a
 * CPU (ReDoS). This is the only place that turns user input into a pattern.
 */

/**
 * Escape every regex metacharacter in a string.
 *
 * Takes: input (string | null | undefined).
 * Returns: the string with metacharacters backslash-escaped; "" for a nullish input.
 */
export function escapeRegex(input) {
  if (input == null) return "";
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive substring matcher from a user's search term.
 *
 * Takes: input (string) — a raw term straight off the query string.
 * Returns: RegExp matching that term literally, anywhere in a field.
 */
export function buildSearchRegex(input) {
  return new RegExp(escapeRegex(input), "i");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/escapeRegex.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Use it in `adminPropertyController.js`**

Add to the imports at the top of the file:

```js
import { buildSearchRegex } from "../utils/escapeRegex.js";
```

Then replace the `$or` block inside `listAdminProperties` — currently:

```js
    query.$or = [
      { reference: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { title: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ];
```

with:

```js
    // Reference or title substring — what staff actually search the table by.
    const pattern = buildSearchRegex(term);
    query.$or = [{ reference: pattern }, { title: pattern }];
```

- [ ] **Step 6: Verify nothing regressed**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all suites pass (134 existing + 5 new = 139).

- [ ] **Step 7: Commit**

```bash
git add backend/utils/escapeRegex.js backend/tests/escapeRegex.test.js backend/controllers/adminPropertyController.js
git commit -m "refactor(backend): extract regex escaping helper"
```

---

## Task 2: Viewing state machine

**Files:**
- Create: `backend/utils/viewingTransitions.js`
- Create: `backend/tests/viewingTransitions.test.js`

**Interfaces:**
- Consumes: `VIEWING_STATUSES` from `utils/constants.js`.
- Produces:
  - `VIEWING_TRANSITIONS: Record<string, string[]>`
  - `isTerminal(status: string) => boolean`
  - `assertTransition(from: string, to: string) => void` — throws `ApiError(400)` on an illegal move; returns silently when legal or when `from === to`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/viewingTransitions.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  VIEWING_TRANSITIONS,
  isTerminal,
  assertTransition,
} from "../utils/viewingTransitions.js";
import { VIEWING_STATUSES } from "../utils/constants.js";

describe("VIEWING_TRANSITIONS", () => {
  it("covers every status in the schema enum", () => {
    // A status with no entry would throw on any transition attempt.
    for (const status of VIEWING_STATUSES) {
      expect(VIEWING_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("never allows a move to a status outside the enum", () => {
    for (const targets of Object.values(VIEWING_TRANSITIONS)) {
      for (const target of targets) {
        expect(VIEWING_STATUSES).toContain(target);
      }
    }
  });
});

describe("isTerminal", () => {
  it("treats rejected, completed and cancelled as final", () => {
    expect(isTerminal("rejected")).toBe(true);
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("treats live states as non-final", () => {
    expect(isTerminal("requested")).toBe(false);
    expect(isTerminal("accepted")).toBe(false);
    expect(isTerminal("rescheduled")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("allows every legal move from requested", () => {
    for (const target of ["accepted", "rejected", "rescheduled", "cancelled"]) {
      expect(() => assertTransition("requested", target)).not.toThrow();
    }
  });

  it("allows an accepted viewing to complete, cancel or reschedule", () => {
    for (const target of ["completed", "cancelled", "rescheduled"]) {
      expect(() => assertTransition("accepted", target)).not.toThrow();
    }
  });

  it("allows a rescheduled viewing to be accepted, rejected or cancelled", () => {
    for (const target of ["accepted", "rejected", "cancelled"]) {
      expect(() => assertTransition("rescheduled", target)).not.toThrow();
    }
  });

  it("refuses to move a completed viewing back to requested", () => {
    expect(() => assertTransition("completed", "requested")).toThrowError(
      /completed.*requested/i,
    );
  });

  it("refuses to reopen a cancelled or rejected viewing", () => {
    expect(() => assertTransition("cancelled", "accepted")).toThrow();
    expect(() => assertTransition("rejected", "accepted")).toThrow();
  });

  it("treats re-applying the current status as a no-op, not an error", () => {
    // A double-clicked Accept button must not produce a 400.
    expect(() => assertTransition("accepted", "accepted")).not.toThrow();
    expect(() => assertTransition("completed", "completed")).not.toThrow();
  });

  it("throws a 400, not a 500", () => {
    try {
      assertTransition("completed", "requested");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error.statusCode).toBe(400);
    }
  });
});
```

> **Note:** `ApiError` exposes its status as `statusCode`. Confirm the property name by
> reading `backend/utils/ApiError.js` before running these tests, and use whatever that
> class actually sets.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/viewingTransitions.test.js`
Expected: FAIL — cannot resolve `../utils/viewingTransitions.js`.

- [ ] **Step 3: Write the implementation**

Create `backend/utils/viewingTransitions.js`:

```js
import ApiError from "./ApiError.js";

/**
 * The viewing lifecycle (§4.2).
 *
 * Six statuses with no rules would let a completed viewing revert to requested, which
 * corrupts the response-time metric and confuses the diary. The API is the only place
 * this can be guaranteed — an admin UI that hides a button is not enforcement.
 */

/**
 * Legal next states, keyed by current state.
 *
 * Terminal states map to an empty array rather than being omitted, so a lookup never
 * returns undefined and the "unknown status" branch stays genuinely exceptional.
 */
export const VIEWING_TRANSITIONS = {
  // A fresh request can go any way: agreed, declined, moved, or withdrawn.
  requested: ["accepted", "rejected", "rescheduled", "cancelled"],
  // A proposed new time is still awaiting an outcome.
  rescheduled: ["accepted", "rejected", "cancelled"],
  // Once agreed it either happens, moves again, or falls through.
  accepted: ["completed", "cancelled", "rescheduled"],
  // Final states. Reopening one would misrepresent what actually happened.
  rejected: [],
  completed: [],
  cancelled: [],
};

/** Whether a status admits no further transitions. */
export function isTerminal(status) {
  return (VIEWING_TRANSITIONS[status] ?? []).length === 0;
}

/**
 * Guard one status change.
 *
 * Takes: from (string) — the stored status; to (string) — the requested status.
 * Returns: nothing when the move is legal.
 * Throws: ApiError 400 naming both states when it is not.
 */
export function assertTransition(from, to) {
  // Re-applying the same status is idempotent, not an error — a double-clicked
  // Accept button must not surface a 400 to the user.
  if (from === to) return;

  const allowed = VIEWING_TRANSITIONS[from];

  // An unrecognised stored status means the data predates this table; fail loudly
  // rather than silently permitting the move.
  if (!allowed) {
    throw new ApiError(400, `Unknown viewing status "${from}"`);
  }

  if (!allowed.includes(to)) {
    throw new ApiError(
      400,
      `A ${from} viewing cannot be moved to ${to}.`,
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/viewingTransitions.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/viewingTransitions.js backend/tests/viewingTransitions.test.js
git commit -m "feat(backend): viewing status transition rules"
```

---

## Task 3: Lead ownership scoping

**Files:**
- Modify: `backend/middleware/auth.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `scopeLeadQuery(query: object, user: object) => object` — returns the query, mutated to add `{ agent: user._id }` for a non-administrator.
  - `canManageLead(user: object, lead: object) => boolean`.

- [ ] **Step 1: Append both helpers to `backend/middleware/auth.js`**

Add at the end of the file, after `canManageProperty`:

```js
/**
 * Restrict a lead list query to what the caller may see.
 *
 * An administrator sees every lead. An agent sees only leads assigned to them, which
 * deliberately excludes *unassigned* leads — a contact-page enquiry or a valuation
 * request belongs to nobody until an administrator assigns it, so no agent should be
 * reading the prospect's phone number in the meantime.
 *
 * MUST be applied last when building a query. Applying it before caller-supplied
 * filters would let `?agent=<colleague id>` overwrite it and widen the scope.
 *
 * Takes: query (object) — the Mongoose filter being assembled; user (req.user).
 * Returns: the same query object, for chaining.
 */
export function scopeLeadQuery(query, user) {
  if (user.role !== "administrator") {
    query.agent = user._id;
  }

  return query;
}

/**
 * Whether this account may read or act on one lead (enquiry or viewing).
 *
 * Mirrors canManageProperty. An agent gets false for a colleague's lead *and* for an
 * unassigned one — the same answer, so the response does not distinguish them.
 *
 * Takes: user (req.user), lead (Enquiry or Viewing document).
 * Returns: true when permitted.
 */
export function canManageLead(user, lead) {
  if (user.role === "administrator") return true;

  // An unassigned lead has no agent — String(undefined) must not accidentally match.
  if (!lead.agent) return false;

  return String(lead.agent) === String(user._id);
}
```

- [ ] **Step 2: Verify nothing regressed**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all suites still pass. (No new tests here — both helpers are
exercised through the route tests in Tasks 4 and 5, where the ownership behaviour that
matters is observable.)

- [ ] **Step 3: Commit**

```bash
git add backend/middleware/auth.js
git commit -m "feat(backend): lead ownership scoping helpers"
```

---

## Task 4: Enquiry inbox endpoints

**Files:**
- Create: `backend/controllers/adminEnquiryController.js`
- Create: `backend/routes/adminEnquiryRoutes.js`
- Create: `backend/tests/api.adminEnquiry.test.js`
- Modify: `backend/app.js`

**Interfaces:**
- Consumes: `scopeLeadQuery`, `canManageLead` (Task 3); `buildSearchRegex` (Task 1); `ENQUIRY_STATUSES`, `ENQUIRY_TYPES`, `ENQUIRY_SOURCES` from `utils/constants.js`.
- Produces: `listEnquiries`, `enquiryStats`, `getEnquiry`, `updateEnquiry`, `deleteEnquiry`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/api.adminEnquiry.test.js`:

```js
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Enquiry from "../model/enquiryModel.js";

/**
 * Enquiry inbox tests.
 *
 * Weighted towards the security boundary rather than the happy path: an agent must
 * never see a colleague's lead or an unassigned one, and must never widen their own
 * scope through a query parameter.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** Logs in and returns the Set-Cookie value for subsequent requests. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Enquiry inbox", () => {
  let adminCookie;
  let agentCookie;
  let agentId;
  let otherAgentId;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    // Two agents, so "my leads" can be told apart from "a colleague's leads".
    const agent = await Agent.create({
      name: "Ada Agent",
      slug: "ada-agent",
      email: "ada@example.com",
      password: "agent-password",
      role: "agent",
    });
    const other = await Agent.create({
      name: "Bola Agent",
      slug: "bola-agent",
      email: "bola@example.com",
      password: "agent-password",
      role: "agent",
    });

    agentId = agent._id;
    otherAgentId = other._id;

    await Enquiry.create([
      {
        name: "Mine",
        phone: "+2348010000001",
        email: "mine@example.com",
        agent: agentId,
        status: "new",
        type: "property_enquiry",
        source: "property_page",
        consentGiven: true,
      },
      {
        name: "Colleague",
        phone: "+2348010000002",
        agent: otherAgentId,
        status: "new",
        type: "property_enquiry",
        source: "property_page",
        consentGiven: true,
      },
      {
        // No agent — a contact-page lead nobody owns yet.
        name: "Unassigned",
        phone: "+2348010000003",
        status: "new",
        type: "general",
        source: "contact_page",
        consentGiven: true,
      },
    ]);

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("ada@example.com", "agent-password");
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/admin/enquiries");
    expect(response.status).toBe(401);
  });

  it("shows an administrator every lead, assigned or not", async () => {
    const response = await request(app).get("/api/admin/enquiries").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiries).toHaveLength(3);
  });

  it("shows an agent only their own leads", async () => {
    const response = await request(app).get("/api/admin/enquiries").set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiries).toHaveLength(1);
    expect(response.body.data.enquiries[0].name).toBe("Mine");
  });

  it("hides unassigned leads from an agent", async () => {
    const response = await request(app).get("/api/admin/enquiries").set("Cookie", agentCookie);

    const names = response.body.data.enquiries.map((e) => e.name);
    expect(names).not.toContain("Unassigned");
  });

  it("does not let an agent widen their scope with ?agent=", async () => {
    // The ownership filter is applied last, so this parameter cannot override it.
    const response = await request(app)
      .get(`/api/admin/enquiries?agent=${otherAgentId}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiries).toHaveLength(1);
    expect(response.body.data.enquiries[0].name).toBe("Mine");
  });

  it("keeps internal notes out of the list response", async () => {
    await Enquiry.updateOne({ name: "Mine" }, { notes: "Secret internal note" });

    const response = await request(app).get("/api/admin/enquiries").set("Cookie", agentCookie);

    expect(JSON.stringify(response.body)).not.toMatch(/Secret internal note/);
  });

  it("includes notes on the detail response", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });
    await Enquiry.updateOne({ _id: enquiry._id }, { notes: "Secret internal note" });

    const response = await request(app)
      .get(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.enquiry.notes).toBe("Secret internal note");
  });

  it("returns 403 when an agent opens a colleague's lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Colleague" });

    const response = await request(app)
      .get(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
  });

  it("returns 403 when an agent opens an unassigned lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Unassigned" });

    const response = await request(app)
      .get(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
  });

  it("filters by status", async () => {
    await Enquiry.updateOne({ name: "Mine" }, { status: "contacted" });

    const response = await request(app)
      .get("/api/admin/enquiries?status=contacted")
      .set("Cookie", adminCookie);

    expect(response.body.data.enquiries).toHaveLength(1);
    expect(response.body.data.enquiries[0].name).toBe("Mine");
  });

  it("searches name, phone and email", async () => {
    const byName = await request(app)
      .get("/api/admin/enquiries?q=Colleague")
      .set("Cookie", adminCookie);
    expect(byName.body.data.enquiries).toHaveLength(1);

    const byPhone = await request(app)
      .get("/api/admin/enquiries?q=0000003")
      .set("Cookie", adminCookie);
    expect(byPhone.body.data.enquiries).toHaveLength(1);

    const byEmail = await request(app)
      .get("/api/admin/enquiries?q=mine@example.com")
      .set("Cookie", adminCookie);
    expect(byEmail.body.data.enquiries).toHaveLength(1);
  });

  it("treats a regex metacharacter in the search term as a literal", async () => {
    // Unescaped, ".*" would match all three leads.
    const response = await request(app)
      .get("/api/admin/enquiries?q=.*")
      .set("Cookie", adminCookie);

    expect(response.body.data.enquiries).toHaveLength(0);
  });

  it("reports counts for every status, including zeroes", async () => {
    const response = await request(app)
      .get("/api/admin/enquiries/stats")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.stats).toMatchObject({
      new: 3,
      contacted: 0,
      viewing_booked: 0,
      closed: 0,
      total: 3,
    });
  });

  it("scopes stats to the caller", async () => {
    const response = await request(app)
      .get("/api/admin/enquiries/stats")
      .set("Cookie", agentCookie);

    expect(response.body.data.stats.total).toBe(1);
  });

  it("updates status and stamps contactedAt on the first move off new", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "contacted", notes: "Called, viewing next week" });

    expect(response.status).toBe(200);
    expect(response.body.data.enquiry.status).toBe("contacted");

    const stored = await Enquiry.findById(enquiry._id).select("+notes");
    expect(stored.contactedAt).toBeTruthy();
    expect(stored.notes).toBe("Called, viewing next week");
  });

  it("rejects an unknown status", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "abducted" });

    expect(response.status).toBe(400);
  });

  it("ignores fields outside the allow-list", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });
    const before = await Enquiry.findById(enquiry._id);

    await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "contacted", contactedAt: "2020-01-01T00:00:00Z", phone: "+000" });

    const after = await Enquiry.findById(enquiry._id);
    // contactedAt is stamped by the model hook, never accepted from the body.
    expect(after.contactedAt.getFullYear()).toBeGreaterThan(2020);
    expect(after.phone).toBe(before.phone);
  });

  it("refuses to let an agent reassign a lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie)
      .send({ agent: otherAgentId });

    expect(response.status).toBe(403);
  });

  it("lets an administrator reassign a lead", async () => {
    const enquiry = await Enquiry.findOne({ name: "Unassigned" });

    const response = await request(app)
      .patch(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", adminCookie)
      .send({ agent: agentId });

    expect(response.status).toBe(200);
    const stored = await Enquiry.findById(enquiry._id);
    expect(String(stored.agent)).toBe(String(agentId));
  });

  it("refuses deletion by an agent", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .delete(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
    expect(await Enquiry.countDocuments()).toBe(3);
  });

  it("hard-deletes for an administrator, leaving no personal data behind", async () => {
    const enquiry = await Enquiry.findOne({ name: "Mine" });

    const response = await request(app)
      .delete(`/api/admin/enquiries/${enquiry._id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    // NDPA erasure means the row is gone, not tombstoned with the phone number intact.
    expect(await Enquiry.findById(enquiry._id)).toBeNull();
    expect(await Enquiry.countDocuments()).toBe(2);
  });

  it("404s for a well-formed id that does not exist", async () => {
    const response = await request(app)
      .get("/api/admin/enquiries/6a99b588fcd254d91ec3ffff")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.adminEnquiry.test.js`
Expected: FAIL — every request 404s because the router is not mounted.

- [ ] **Step 3: Write `backend/controllers/adminEnquiryController.js`**

```js
import Enquiry from "../model/enquiryModel.js";
import ApiError from "../utils/ApiError.js";
import { buildSearchRegex } from "../utils/escapeRegex.js";
import { scopeLeadQuery, canManageLead } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  ENQUIRY_SOURCES,
} from "../utils/constants.js";

/**
 * The enquiry inbox (§4.2).
 *
 * Every lead the public site captures lands here. Access is governed by the §7
 * ownership rule: an agent works their own leads, an administrator sees everything
 * including leads nobody has been assigned yet.
 */

/**
 * Fields a PATCH may write.
 *
 * `contactedAt` and `closedAt` are stamped by the model's pre-save hook and must never
 * be accepted from a client — they are the agency's response-time metric, and a
 * writable timestamp is a falsifiable one. Identity fields (name/phone/email) are
 * what the prospect submitted and are not staff-editable.
 */
const WRITABLE_FIELDS = ["status", "notes", "agent"];

/**
 * Load one enquiry and check the caller may act on it.
 *
 * Takes: id (string), user (req.user), options.withNotes (boolean).
 * Returns: the Enquiry document.
 * Throws: ApiError 404 when it does not exist, 403 when it is not the caller's.
 */
async function loadManageable(id, user, { withNotes = false } = {}) {
  const query = Enquiry.findById(id);
  // notes is select:false on the schema, so it must be asked for explicitly.
  if (withNotes) query.select("+notes");

  const enquiry = await query;

  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  // 403 rather than 404: these are authenticated colleagues, not anonymous probes,
  // and the clearer error is more useful than hiding existence from staff.
  if (!canManageLead(user, enquiry)) {
    throw new ApiError(403, "You can only manage leads assigned to you");
  }

  return enquiry;
}

/**
 * Build the shared list filter from the query string.
 *
 * Ownership scoping is applied by the caller AFTER this returns, so a caller-supplied
 * `agent` can never widen it.
 *
 * Takes: query (req.query).
 * Returns: a Mongoose filter object.
 */
function buildEnquiryFilter(query) {
  const filter = {};

  // Enum filters are validated against constants.js — an unknown value is ignored
  // rather than 400ing, so a stale admin UI never breaks the inbox.
  if (ENQUIRY_STATUSES.includes(query.status)) filter.status = query.status;
  if (ENQUIRY_TYPES.includes(query.type)) filter.type = query.type;
  if (ENQUIRY_SOURCES.includes(query.source)) filter.source = query.source;

  if (query.agent) filter.agent = query.agent;
  if (query.property) filter.property = query.property;

  if (query.q) {
    const pattern = buildSearchRegex(String(query.q).trim());
    // The three fields staff actually search a lead by.
    filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }];
  }

  // Date range on createdAt. An unparseable date is dropped rather than producing an
  // Invalid Date, which Mongo would reject with an unhelpful cast error.
  const createdAt = {};
  const from = new Date(query.dateFrom);
  const to = new Date(query.dateTo);
  if (query.dateFrom && !Number.isNaN(from.getTime())) createdAt.$gte = from;
  if (query.dateTo && !Number.isNaN(to.getTime())) createdAt.$lte = to;
  if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;

  return filter;
}

/**
 * GET /api/admin/enquiries — the inbox.
 *
 * Takes: (req, res); query: status, type, source, agent, property, q, dateFrom,
 *        dateTo, sort, page, limit.
 * Returns: nothing; sends { success, data: { enquiries, pagination } }.
 */
export async function listEnquiries(req, res) {
  const filter = buildEnquiryFilter(req.query);

  // Applied last: ownership always wins over anything the caller asked for.
  scopeLeadQuery(filter, req.user);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  // Newest first is inbox order. "oldest" is for working a backlog from the top.
  const sort = req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .populate([
        { path: "property", select: "title slug reference" },
        { path: "agent", select: "name slug" },
      ])
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Enquiry.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      enquiries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

/**
 * GET /api/admin/enquiries/stats — counts by status for the inbox badge.
 *
 * Must be declared before /:id in the router, or "stats" is read as an id.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { stats } } with every status key present.
 */
export async function enquiryStats(req, res) {
  const filter = scopeLeadQuery({}, req.user);

  const grouped = await Enquiry.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  // Seed every status at zero first, so the frontend never renders "undefined" for a
  // status that happens to have no leads today.
  const stats = Object.fromEntries(ENQUIRY_STATUSES.map((status) => [status, 0]));
  let total = 0;

  for (const row of grouped) {
    stats[row._id] = row.count;
    total += row.count;
  }

  stats.total = total;

  res.status(200).json({ success: true, data: { stats } });
}

/**
 * GET /api/admin/enquiries/:id — one lead, including internal notes.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { enquiry } }.
 * Throws: ApiError 404 / 403.
 */
export async function getEnquiry(req, res) {
  const enquiry = await loadManageable(req.params.id, req.user, { withNotes: true });

  await enquiry.populate([
    { path: "property", select: "title slug reference" },
    { path: "agent", select: "name slug phone" },
  ]);

  res.status(200).json({ success: true, data: { enquiry } });
}

/**
 * PATCH /api/admin/enquiries/:id — move a lead through the pipeline.
 *
 * Takes: (req, res); body: status, notes, agent.
 * Returns: nothing; sends { success, data: { enquiry } }.
 * Throws: ApiError 400 on an invalid status, 403 when an agent tries to reassign.
 */
export async function updateEnquiry(req, res) {
  const enquiry = await loadManageable(req.params.id, req.user, { withNotes: true });

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );

  // Reassignment is an administrator's call. An agent must not be able to hand a lead
  // away to avoid it, nor claim one that was never theirs.
  if ("agent" in updates && req.user.role !== "administrator") {
    throw new ApiError(403, "Only an administrator can reassign a lead");
  }

  if ("status" in updates && !ENQUIRY_STATUSES.includes(updates.status)) {
    throw new ApiError(400, `"${updates.status}" is not a valid enquiry status`);
  }

  Object.assign(enquiry, updates);
  // save() rather than findByIdAndUpdate, so the pre-save hook that stamps
  // contactedAt/closedAt actually runs.
  await enquiry.save();

  res.status(200).json({ success: true, data: { enquiry } });
}

/**
 * DELETE /api/admin/enquiries/:id — permanent removal. Administrator only.
 *
 * Hard, not soft: NDPA 2023 erasure means the personal data is gone. A tombstone
 * retaining name, phone and email would not satisfy an erasure request.
 *
 * Takes: (req, res).
 * Returns: nothing; sends 204.
 * Throws: ApiError 404.
 */
export async function deleteEnquiry(req, res) {
  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  await enquiry.deleteOne();

  // Erasure is irreversible, so leave an audit trail of who did it — without logging
  // the personal data that was just erased.
  logger.info(
    `Enquiry ${req.params.id} permanently deleted by ${req.user.email} (${req.user._id})`
  );

  res.status(204).end();
}
```

- [ ] **Step 4: Write `backend/routes/adminEnquiryRoutes.js`**

```js
import { Router } from "express";

import {
  listEnquiries,
  enquiryStats,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from "../controllers/adminEnquiryController.js";
import { requireAuth, authorizeRole } from "../middleware/auth.js";

/**
 * Admin enquiry routes — the lead inbox (§4.2).
 *
 * Nothing here is public. Ownership scoping happens inside the controller, because it
 * shapes the query rather than gating the route.
 */
const router = Router();

// Every route below requires a session.
router.use(requireAuth);

// MUST precede "/:id" — otherwise Express matches "stats" as an enquiry id and the
// route 404s on a CastError.
router.get("/stats", enquiryStats);

router.get("/", listEnquiries);
router.get("/:id", getEnquiry);
router.patch("/:id", updateEnquiry);

// Permanent erasure is an administrator's decision alone.
router.delete("/:id", authorizeRole("administrator"), deleteEnquiry);

export default router;
```

- [ ] **Step 5: Mount it in `backend/app.js`**

Add the import beside the other route imports:

```js
import adminEnquiryRoutes from "./routes/adminEnquiryRoutes.js";
```

Add the mount immediately after the `adminPropertyRoutes` line:

```js
  app.use("/api/admin/enquiries", adminEnquiryRoutes);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.adminEnquiry.test.js`
Expected: PASS, 22 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/adminEnquiryController.js backend/routes/adminEnquiryRoutes.js backend/tests/api.adminEnquiry.test.js backend/app.js
git commit -m "feat(backend): enquiry inbox endpoints"
```

---

## Task 5: Viewing management endpoints

**Files:**
- Create: `backend/controllers/adminViewingController.js`
- Create: `backend/routes/adminViewingRoutes.js`
- Create: `backend/tests/api.adminViewing.test.js`
- Modify: `backend/app.js`

**Interfaces:**
- Consumes: `assertTransition`, `isTerminal` (Task 2); `scopeLeadQuery`, `canManageLead` (Task 3); `VIEWING_STATUSES` from `utils/constants.js`.
- Produces: `listViewings`, `getViewing`, `updateViewing`, `deleteViewing`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/api.adminViewing.test.js`:

```js
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Viewing from "../model/viewingModel.js";

/**
 * Viewing management tests.
 *
 * Two boundaries matter here: the §7 ownership rule, and the status transition
 * whitelist that stops a completed viewing being reopened.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** A date safely in the future, so "must be upcoming" checks pass deterministically. */
function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Logs in and returns the Set-Cookie value for subsequent requests. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Viewing management", () => {
  let adminCookie;
  let agentCookie;
  let agentId;
  let otherAgentId;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    const agent = await Agent.create({
      name: "Ada Agent",
      slug: "ada-agent",
      email: "ada@example.com",
      password: "agent-password",
      role: "agent",
    });
    const other = await Agent.create({
      name: "Bola Agent",
      slug: "bola-agent",
      email: "bola@example.com",
      password: "agent-password",
      role: "agent",
    });

    agentId = agent._id;
    otherAgentId = other._id;

    await Viewing.create([
      {
        name: "Mine",
        phone: "+2348010000001",
        email: "mine@example.com",
        agent: agentId,
        requestedFor: daysFromNow(3),
        status: "requested",
      },
      {
        name: "Colleague",
        phone: "+2348010000002",
        agent: otherAgentId,
        requestedFor: daysFromNow(4),
        status: "requested",
      },
      {
        name: "Unassigned",
        phone: "+2348010000003",
        requestedFor: daysFromNow(5),
        status: "requested",
      },
    ]);

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("ada@example.com", "agent-password");
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/admin/viewings");
    expect(response.status).toBe(401);
  });

  it("shows an agent only their own viewings", async () => {
    const response = await request(app).get("/api/admin/viewings").set("Cookie", agentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.viewings).toHaveLength(1);
    expect(response.body.data.viewings[0].name).toBe("Mine");
  });

  it("shows an administrator all viewings", async () => {
    const response = await request(app).get("/api/admin/viewings").set("Cookie", adminCookie);
    expect(response.body.data.viewings).toHaveLength(3);
  });

  it("sorts the diary soonest-first", async () => {
    const response = await request(app).get("/api/admin/viewings").set("Cookie", adminCookie);

    const dates = response.body.data.viewings.map((v) => new Date(v.requestedFor).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("returns 403 for a colleague's viewing", async () => {
    const viewing = await Viewing.findOne({ name: "Colleague" });

    const response = await request(app)
      .get(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie);

    expect(response.status).toBe(403);
  });

  it("accepts a request and inherits requestedFor when no time is given", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "accepted" });

    expect(response.status).toBe(200);

    const stored = await Viewing.findById(viewing._id);
    expect(stored.status).toBe("accepted");
    // Accepting the ask as-is is the common case; the client shouldn't have to echo
    // the date back.
    expect(stored.scheduledFor.getTime()).toBe(stored.requestedFor.getTime());
    expect(stored.respondedAt).toBeTruthy();
  });

  it("accepts with an explicit scheduledFor", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    const when = daysFromNow(7);

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "accepted", scheduledFor: when.toISOString() });

    expect(response.status).toBe(200);
    const stored = await Viewing.findById(viewing._id);
    expect(stored.scheduledFor.toISOString()).toBe(when.toISOString());
  });

  it("rejects with a message the prospect will see", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rejected", responseMessage: "Property is under offer." });

    expect(response.status).toBe(200);
    const stored = await Viewing.findById(viewing._id);
    expect(stored.status).toBe("rejected");
    expect(stored.responseMessage).toBe("Property is under offer.");
  });

  it("requires a new future time to reschedule", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const missing = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rescheduled" });
    expect(missing.status).toBe(400);

    const past = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rescheduled", scheduledFor: daysFromNow(-2).toISOString() });
    expect(past.status).toBe(400);
  });

  it("reschedules to a valid future time", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    const when = daysFromNow(10);

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "rescheduled", scheduledFor: when.toISOString() });

    expect(response.status).toBe(200);
    const stored = await Viewing.findById(viewing._id);
    expect(stored.status).toBe("rescheduled");
    expect(stored.scheduledFor.toISOString()).toBe(when.toISOString());
  });

  it("refuses an illegal transition", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    await Viewing.updateOne({ _id: viewing._id }, { status: "completed" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "requested" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/completed/i);
  });

  it("treats re-applying the same status as a no-op", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie)
      .send({ status: "requested" });

    // A double-clicked button must not surface a 400.
    expect(response.status).toBe(200);
  });

  it("keeps notes out of the list and present on the detail", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });
    await Viewing.updateOne({ _id: viewing._id }, { notes: "Internal only note" });

    const list = await request(app).get("/api/admin/viewings").set("Cookie", agentCookie);
    expect(JSON.stringify(list.body)).not.toMatch(/Internal only note/);

    const detail = await request(app)
      .get(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie);
    expect(detail.body.data.viewing.notes).toBe("Internal only note");
  });

  it("refuses deletion by an agent and allows it for an administrator", async () => {
    const viewing = await Viewing.findOne({ name: "Mine" });

    const refused = await request(app)
      .delete(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", agentCookie);
    expect(refused.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/admin/viewings/${viewing._id}`)
      .set("Cookie", adminCookie);
    expect(allowed.status).toBe(204);
    expect(await Viewing.findById(viewing._id)).toBeNull();
  });

  it("filters to upcoming viewings only", async () => {
    await Viewing.create({
      name: "Past",
      phone: "+2348010000004",
      agent: agentId,
      requestedFor: daysFromNow(-5),
      status: "completed",
    });

    const response = await request(app)
      .get("/api/admin/viewings?upcoming=true")
      .set("Cookie", agentCookie);

    const names = response.body.data.viewings.map((v) => v.name);
    expect(names).not.toContain("Past");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.adminViewing.test.js`
Expected: FAIL — every request 404s because the router is not mounted.

- [ ] **Step 3: Write `backend/controllers/adminViewingController.js`**

```js
import Viewing from "../model/viewingModel.js";
import ApiError from "../utils/ApiError.js";
import { scopeLeadQuery, canManageLead } from "../middleware/auth.js";
import { assertTransition } from "../utils/viewingTransitions.js";
import logger from "../utils/logger.js";
import { VIEWING_STATUSES } from "../utils/constants.js";
import { sendEmail } from "../utils/emailService.js";
import {
  prospectViewingAccepted,
  prospectViewingRejected,
  prospectViewingRescheduled,
} from "../emails/viewingEmails.js";
import Settings from "../model/settingsModel.js";

/**
 * Viewing management (§4.2) — the agency's diary.
 *
 * Status changes go through the transition whitelist in utils/viewingTransitions.js
 * rather than being written straight to the document, so a completed viewing can never
 * be reopened by a stale client.
 */

/**
 * Fields a PATCH may write. `respondedAt` is stamped by the model's pre-save hook and
 * is deliberately absent — it is a response-time metric, not client data.
 */
const WRITABLE_FIELDS = ["status", "scheduledFor", "responseMessage", "notes"];

/**
 * Load one viewing and check the caller may act on it.
 *
 * Takes: id (string), user (req.user), options.withNotes (boolean).
 * Returns: the Viewing document.
 * Throws: ApiError 404 when it does not exist, 403 when it is not the caller's.
 */
async function loadManageable(id, user, { withNotes = false } = {}) {
  const query = Viewing.findById(id);
  if (withNotes) query.select("+notes");

  const viewing = await query;

  if (!viewing) {
    throw new ApiError(404, "Viewing not found");
  }

  if (!canManageLead(user, viewing)) {
    throw new ApiError(403, "You can only manage viewings assigned to you");
  }

  return viewing;
}

/**
 * Email the prospect about a status change. Best-effort.
 *
 * Called AFTER the response is sent: a slow mail provider must never slow a staff
 * member's click, and a mail failure must never undo a status change. Silent when the
 * prospect gave no email — phone is the required field, email is optional.
 *
 * Takes: viewing (Viewing document), status (string).
 * Returns: a promise that always resolves.
 */
async function notifyProspect(viewing, status) {
  if (!viewing.email) return;

  try {
    const settings = await Settings.get();
    const agencyName = settings?.agencyName ?? "Our team";

    const builders = {
      accepted: prospectViewingAccepted,
      rejected: prospectViewingRejected,
      rescheduled: prospectViewingRescheduled,
    };

    const build = builders[status];
    // Only the three outcomes the prospect needs to hear about. "completed" and
    // "cancelled" are internal bookkeeping.
    if (!build) return;

    const { subject, html } = build({ viewing, agencyName });
    await sendEmail({ to: viewing.email, subject, html });
  } catch (error) {
    // Swallowed on purpose — the status change already succeeded and is what matters.
    logger.warn(`Viewing notification failed for ${viewing._id}: ${error.message}`);
  }
}

/**
 * GET /api/admin/viewings — the diary.
 *
 * Takes: (req, res); query: status, agent, property, dateFrom, dateTo, upcoming,
 *        page, limit.
 * Returns: nothing; sends { success, data: { viewings, pagination } }.
 */
export async function listViewings(req, res) {
  const filter = {};

  if (VIEWING_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.agent) filter.agent = req.query.agent;
  if (req.query.property) filter.property = req.query.property;

  // Date window on the requested date, which is what a diary is organised by.
  const requestedFor = {};
  const from = new Date(req.query.dateFrom);
  const to = new Date(req.query.dateTo);
  if (req.query.dateFrom && !Number.isNaN(from.getTime())) requestedFor.$gte = from;
  if (req.query.dateTo && !Number.isNaN(to.getTime())) requestedFor.$lte = to;

  // The default view a staff member wants on opening the page.
  if (req.query.upcoming === "true") {
    requestedFor.$gte = requestedFor.$gte ?? new Date();
  }

  if (Object.keys(requestedFor).length > 0) filter.requestedFor = requestedFor;

  // Applied last: ownership always wins over anything the caller asked for.
  scopeLeadQuery(filter, req.user);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const [viewings, total] = await Promise.all([
    Viewing.find(filter)
      .populate([
        { path: "property", select: "title slug reference" },
        { path: "agent", select: "name slug" },
      ])
      // Soonest first — a diary reads forwards, unlike an inbox.
      .sort({ requestedFor: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Viewing.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      viewings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

/**
 * GET /api/admin/viewings/:id — one viewing, including internal notes.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { viewing } }.
 * Throws: ApiError 404 / 403.
 */
export async function getViewing(req, res) {
  const viewing = await loadManageable(req.params.id, req.user, { withNotes: true });

  await viewing.populate([
    { path: "property", select: "title slug reference" },
    { path: "agent", select: "name slug phone" },
  ]);

  res.status(200).json({ success: true, data: { viewing } });
}

/**
 * PATCH /api/admin/viewings/:id — accept, reject, reschedule, complete or cancel.
 *
 * Takes: (req, res); body: status, scheduledFor, responseMessage, notes.
 * Returns: nothing; sends { success, data: { viewing } }.
 * Throws: ApiError 400 on an illegal transition or a bad reschedule, 404 / 403.
 */
export async function updateViewing(req, res) {
  const viewing = await loadManageable(req.params.id, req.user, { withNotes: true });

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );

  const nextStatus = updates.status;
  // Captured before the write so the notification knows whether anything changed.
  const statusChanged = nextStatus != null && nextStatus !== viewing.status;

  if (nextStatus != null) {
    if (!VIEWING_STATUSES.includes(nextStatus)) {
      throw new ApiError(400, `"${nextStatus}" is not a valid viewing status`);
    }

    // Throws 400 on an illegal move; a no-op when the status is unchanged.
    assertTransition(viewing.status, nextStatus);

    if (nextStatus === "accepted") {
      // Accepting the prospect's own suggested time is the common case, so the client
      // does not have to echo it back.
      updates.scheduledFor = updates.scheduledFor ?? viewing.requestedFor;
    }

    if (nextStatus === "rescheduled" && statusChanged) {
      if (!updates.scheduledFor) {
        throw new ApiError(400, "A new date is required to reschedule a viewing");
      }

      const when = new Date(updates.scheduledFor);

      if (Number.isNaN(when.getTime())) {
        throw new ApiError(400, "The new viewing date is not a valid date");
      }

      // A time in the past cannot be a reschedule — it is a data-entry error.
      if (when.getTime() <= Date.now()) {
        throw new ApiError(400, "The new viewing date must be in the future");
      }

      // Moving a viewing to the time it already had is not a reschedule.
      if (viewing.scheduledFor && when.getTime() === viewing.scheduledFor.getTime()) {
        throw new ApiError(400, "The new viewing date must differ from the current one");
      }
    }
  }

  Object.assign(viewing, updates);
  // save() rather than findByIdAndUpdate, so the hook that stamps respondedAt runs.
  await viewing.save();

  res.status(200).json({ success: true, data: { viewing } });

  // After the response: the prospect's email is a courtesy, not part of the write.
  if (statusChanged) {
    void notifyProspect(viewing, nextStatus);
  }
}

/**
 * DELETE /api/admin/viewings/:id — permanent removal. Administrator only.
 *
 * Hard, not soft, for the same NDPA reason as enquiries: the record holds the
 * prospect's name, phone and email.
 *
 * Takes: (req, res).
 * Returns: nothing; sends 204.
 * Throws: ApiError 404.
 */
export async function deleteViewing(req, res) {
  const viewing = await Viewing.findById(req.params.id);

  if (!viewing) {
    throw new ApiError(404, "Viewing not found");
  }

  await viewing.deleteOne();

  logger.info(
    `Viewing ${req.params.id} permanently deleted by ${req.user.email} (${req.user._id})`
  );

  res.status(204).end();
}
```

- [ ] **Step 4: Write `backend/routes/adminViewingRoutes.js`**

```js
import { Router } from "express";

import {
  listViewings,
  getViewing,
  updateViewing,
  deleteViewing,
} from "../controllers/adminViewingController.js";
import { requireAuth, authorizeRole } from "../middleware/auth.js";

/**
 * Admin viewing routes — the agency diary (§4.2).
 *
 * Ownership scoping happens inside the controller, because it shapes the query rather
 * than gating the route.
 */
const router = Router();

router.use(requireAuth);

router.get("/", listViewings);
router.get("/:id", getViewing);
router.patch("/:id", updateViewing);

// Permanent erasure is an administrator's decision alone.
router.delete("/:id", authorizeRole("administrator"), deleteViewing);

export default router;
```

- [ ] **Step 5: Mount it in `backend/app.js`**

Add the import beside the other route imports:

```js
import adminViewingRoutes from "./routes/adminViewingRoutes.js";
```

Add the mount immediately after the `adminEnquiryRoutes` line:

```js
  app.use("/api/admin/viewings", adminViewingRoutes);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.adminViewing.test.js`
Expected: PASS, 15 tests. This depends on Task 6's `viewingEmails.js` existing — build
Task 6 first if the import fails.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/adminViewingController.js backend/routes/adminViewingRoutes.js backend/tests/api.adminViewing.test.js backend/app.js
git commit -m "feat(backend): viewing management endpoints"
```

---

## Task 6: Viewing email templates

`emails/enquiryEmails.js` already holds two viewing templates despite its name. Adding
three more would make the misnaming worse, so this task splits by resource — matching how
controllers and routes are already organised. This is the only refactor in scope.

**Files:**
- Create: `backend/emails/viewingEmails.js`
- Modify: `backend/emails/enquiryEmails.js`
- Modify: `backend/controllers/enquiryController.js`

**Interfaces:**
- Consumes: nothing.
- Produces, each returning `{ subject: string, html: string }`:
  - `agentViewingNotification({ viewing, property })` — moved verbatim
  - `prospectViewingConfirmation({ viewing, property, agencyName })` — moved verbatim
  - `prospectViewingAccepted({ viewing, agencyName })`
  - `prospectViewingRejected({ viewing, agencyName })`
  - `prospectViewingRescheduled({ viewing, agencyName })`

- [ ] **Step 1: Read the existing templates**

Run: `cd backend && sed -n '95,160p' emails/enquiryEmails.js`

Note the exact shape of `agentViewingNotification` and `prospectViewingConfirmation` —
including any shared helper they call (a layout wrapper or an escaping function) — so the
move is verbatim and any shared helper is imported rather than duplicated.

- [ ] **Step 2: Create `backend/emails/viewingEmails.js`**

Move `agentViewingNotification` and `prospectViewingConfirmation` across unchanged,
importing whatever shared helper they used from `enquiryEmails.js` (or, if that helper is
only used by viewing templates, move it too). Then add the three response templates:

```js
/**
 * Format a date for a Nigerian reader: weekday, date, month, then the time.
 *
 * Kept local to this file — it exists for email copy, not for the API.
 */
function formatWhen(date) {
  if (!date) return "a time to be confirmed";

  return new Date(date).toLocaleString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Sent when staff accept a viewing request.
 *
 * Takes: { viewing, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingAccepted({ viewing, agencyName }) {
  return {
    subject: `Your viewing is confirmed — ${formatWhen(viewing.scheduledFor)}`,
    html: `
      <p>Hello ${viewing.name},</p>
      <p>Your viewing is confirmed for <strong>${formatWhen(viewing.scheduledFor)}</strong>.</p>
      ${viewing.responseMessage ? `<p>${viewing.responseMessage}</p>` : ""}
      <p>If you need to change the time, reply to this email or give us a call.</p>
      <p>— ${agencyName}</p>
    `,
  };
}

/**
 * Sent when staff decline a viewing request.
 *
 * The responseMessage carries the reason, so the prospect isn't left guessing why the
 * state changed.
 *
 * Takes: { viewing, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingRejected({ viewing, agencyName }) {
  return {
    subject: "About your viewing request",
    html: `
      <p>Hello ${viewing.name},</p>
      <p>We're sorry — we aren't able to arrange that viewing.</p>
      ${viewing.responseMessage ? `<p>${viewing.responseMessage}</p>` : ""}
      <p>We'd still be glad to help you find something suitable. Just reply to this email.</p>
      <p>— ${agencyName}</p>
    `,
  };
}

/**
 * Sent when staff propose a different time.
 *
 * Takes: { viewing, agencyName }.
 * Returns: { subject, html }.
 */
export function prospectViewingRescheduled({ viewing, agencyName }) {
  return {
    subject: `A new time for your viewing — ${formatWhen(viewing.scheduledFor)}`,
    html: `
      <p>Hello ${viewing.name},</p>
      <p>We've proposed a new time for your viewing:
         <strong>${formatWhen(viewing.scheduledFor)}</strong>.</p>
      ${viewing.responseMessage ? `<p>${viewing.responseMessage}</p>` : ""}
      <p>Let us know if that works for you.</p>
      <p>— ${agencyName}</p>
    `,
  };
}
```

- [ ] **Step 3: Remove the two moved templates from `enquiryEmails.js`**

Delete `agentViewingNotification` and `prospectViewingConfirmation` from
`backend/emails/enquiryEmails.js`. Leave `agentEnquiryNotification` and
`prospectEnquiryConfirmation` in place. If a shared helper is now unused there, remove it;
if it is still used by the enquiry templates, keep it and export it so
`viewingEmails.js` can import it.

- [ ] **Step 4: Update the import in `enquiryController.js`**

Split the existing import at `backend/controllers/enquiryController.js:14` so the two
viewing templates come from their new home:

```js
import {
  agentEnquiryNotification,
  prospectEnquiryConfirmation,
} from "../emails/enquiryEmails.js";
import {
  agentViewingNotification,
  prospectViewingConfirmation,
} from "../emails/viewingEmails.js";
```

Keep only the names that file actually uses — check which of the four it imports today
before writing this.

- [ ] **Step 5: Run the whole suite**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all suites pass — the existing viewing-submission tests in
`tests/api.enquiry.test.js` prove the move didn't break the public endpoints.

- [ ] **Step 6: Commit**

```bash
git add backend/emails backend/controllers/enquiryController.js
git commit -m "feat(backend): viewing response email templates"
```

---

## Task 7: Documentation

**Files:**
- Modify: `docs/API-REFERENCE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the endpoints to `docs/API-REFERENCE.md`**

Add a section after the existing "Authenticated endpoints (admin panel)" table,
documenting each of the nine routes with its query parameters, request body and response
shape, in the same style as the existing entries. Include:

- The ownership rule: agents see only leads assigned to them; unassigned leads are
  administrator-only; a violation is **403**, not 404.
- `notes` is absent from list responses and present on detail responses.
- `GET /api/admin/enquiries/stats` returns every `ENQUIRY_STATUSES` key including
  zeroes, plus `total`.
- The viewing transition table from §4 of the spec, verbatim.
- `DELETE` on either resource is a **hard** delete and administrator-only.

- [ ] **Step 2: Shrink the "Not built yet" section in `docs/API-REFERENCE.md`**

It currently reads:

> No endpoints exist for: enquiry inbox / viewing management (reading or updating
> leads), staff management, blog posts, pages, testimonials, settings updates, or media
> upload.

Remove "enquiry inbox / viewing management (reading or updating leads)" from that list.

- [ ] **Step 3: Update `CLAUDE.md`**

- In the status block, move enquiry inbox and viewing management from "Not built" to
  built, leaving staff management, blog editor, settings admin and media upload.
- Add the nine routes to the "API endpoints (authenticated, built)" table.
- Add to the auth rules: lead ownership follows §7 — agents see only their own leads,
  unassigned leads are administrator-only, and deletion is a hard delete restricted to
  administrators for NDPA erasure.
- Update the test count from 134 to the new total.

- [ ] **Step 4: Verify and commit**

Run: `cd backend && npm run lint && npm test`
Expected: lint silent; all suites pass.

```bash
git add docs/API-REFERENCE.md CLAUDE.md
git commit -m "docs: document lead operations endpoints"
```

---

## Self-review notes

**Spec coverage:** §3.1 enquiries (Task 4) · §3.2 viewings (Task 5) · §4 state machine
(Task 2) · §5 ownership scoping (Task 3) · §6 email (Tasks 5, 6) · §7 file list (all) ·
§8 testing (Tasks 1, 2, 4, 5).

**Two additions beyond the spec's file list**, both justified by what the code needed:
`utils/escapeRegex.js` got its own task because `adminPropertyController` already
duplicated the escape inline twice, and Task 7 was added because the spec's §7 lists doc
updates that no other task owned.

**Dependency order:** Task 5 imports from Task 6's `viewingEmails.js`. Build 6 before 5,
or expect the import to fail. Tasks 1–3 are independent of each other.

**No new dependencies.**

# Lead Operations API — Design

Date: 2026-09-04
Scope: Sub-project A of the backend gap-filling work — the enquiry inbox and viewing
management endpoints (§4.2). Everything a staff member needs to see and action a lead
that the public site has already captured.

---

## 1. Why this first

The public site captures leads, but nobody can see them. `POST /api/enquiries` and
`POST /api/viewings` write to the database and fire a best-effort email; there is no
endpoint to read a lead, change its status, or respond to a viewing request. The models
exist and are complete — only routes and controllers are missing.

This slice needs no new credentials and no new dependencies.

---

## 2. Decision record

| Decision | Choice | Reason |
| --- | --- | --- |
| Lead visibility | Agents see only leads assigned to them; **unassigned leads are administrator-only** | Mirrors the §7 property ownership rule. Nobody owns a contact-page enquiry, so only an administrator acts on it until it is assigned |
| Deletion | **Hard delete, administrator-only**, logged | NDPA 2023 erasure means the personal data is actually gone. A soft delete keeps name/phone/email on record and cannot answer an erasure request |
| Viewing statuses | **Server-enforced transition whitelist** | Six statuses with no rules lets a completed viewing revert to requested. The API is the only place this can be guaranteed |
| Daily digest (§4.3) | **Deferred** | Needs a scheduler decision that is really a deployment question, and `RESEND_API_KEY` is empty so it cannot be verified |
| Ownership violation response | **403**, matching `adminPropertyController` | These are authenticated colleagues, not anonymous attackers. The public surface still 404s to avoid leaking existence |
| Bulk actions | **Out of scope** | YAGNI until there is a real backlog to clear |

---

## 3. Endpoints

All mount under `/api/admin`, all behind `router.use(requireAuth)`.

### 3.1 Enquiries — `routes/adminEnquiryRoutes.js`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/enquiries` | staff | List, scoped to the caller |
| GET | `/api/admin/enquiries/stats` | staff | Counts by status; **must be declared before `/:id`** |
| GET | `/api/admin/enquiries/:id` | staff, owner | Detail; explicitly selects `notes` |
| PATCH | `/api/admin/enquiries/:id` | staff, owner | `status`, `notes`; `agent` reassignment administrator-only |
| DELETE | `/api/admin/enquiries/:id` | **administrator** | Hard delete |

**List query parameters:** `status`, `type`, `source`, `agent`, `property`, `q`,
`dateFrom`, `dateTo`, `page`, `limit`, `sort`.

- `q` searches `name`, `phone` and `email` with an anchored, escaped case-insensitive
  regex. User input is escaped before it reaches the regex — an unescaped `.*` in a
  phone field is a trivial ReDoS.
- `dateFrom`/`dateTo` filter on `createdAt`. An unparseable date is ignored rather than
  producing an `Invalid Date` query.
- Default sort is `-createdAt` (newest lead first — the inbox order). `sort=oldest`
  inverts it, for working a backlog from the top.
- `page` defaults to 1; `limit` defaults to 20, capped at 100. Same as
  `listAdminProperties`.
- `agent` and `property` are ignored for an agent caller when they would widen the
  scope — the ownership filter is applied last and always wins.

**`stats` response:** `{ stats: { new: 12, contacted: 4, viewing_booked: 2, closed: 30, total: 48 } }`
— scoped to the caller exactly like the list. Every `ENQUIRY_STATUSES` key is present
even at zero, so the frontend never renders `undefined`.

**PATCH body:** allow-listed to `status`, `notes`, `agent`. Anything else is dropped
silently, following `WRITABLE_FIELDS` in `adminPropertyController`. `contactedAt` and
`closedAt` are stamped by the model's existing `pre("save")` hook and must never be
accepted from the body.

`agent` reassignment is rejected with 403 for a non-administrator. An agent must not be
able to hand a lead away, nor claim one that is not theirs.

### 3.2 Viewings — `routes/adminViewingRoutes.js`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/viewings` | staff | The diary, scoped to the caller |
| GET | `/api/admin/viewings/:id` | staff, owner | Detail; explicitly selects `notes` |
| PATCH | `/api/admin/viewings/:id` | staff, owner | Transition + scheduling + response |
| DELETE | `/api/admin/viewings/:id` | **administrator** | Hard delete |

**List query parameters:** `status`, `agent`, `property`, `dateFrom`, `dateTo`, `page`,
`limit`, `upcoming`.

- Default sort is `requestedFor` **ascending** — a diary reads soonest-first, unlike an
  inbox. This deliberately differs from the enquiry list.
- `upcoming=true` restricts to `requestedFor >= now`, which is the default view a staff
  member wants on opening the page.

**PATCH body:** allow-listed to `status`, `scheduledFor`, `responseMessage`, `notes`.
`respondedAt` is stamped by the model hook.

---

## 4. The viewing state machine

Enforced in `utils/viewingTransitions.js`, not inline in the controller, so the rules are
testable on their own and the controller stays thin.

```
requested   → accepted | rejected | rescheduled | cancelled
rescheduled → accepted | rejected | cancelled
accepted    → completed | cancelled | rescheduled
rejected    → (terminal)
completed   → (terminal)
cancelled   → (terminal)
```

Rules:

- An illegal transition is `ApiError(400, ...)` naming both states, e.g.
  *"A completed viewing cannot be moved back to requested."*
- Setting the same status again is a no-op, not an error — a double-click on Accept must
  not 400.
- `accepted` requires a `scheduledFor`. When the body omits it, it defaults to
  `requestedFor` — accepting the ask as-is is the common case and shouldn't require the
  client to echo the date back.
- `rescheduled` requires an explicit `scheduledFor` that is **in the future** and
  **different from the current one**. A reschedule to the same time is not a reschedule.
- `rejected` and `cancelled` should carry a `responseMessage`; it is not required,
  because a lead that goes cold shouldn't be blocked from being closed.

Both `Enquiry.status` and `Viewing.status` are validated against the enums in
`utils/constants.js`. No status list is re-typed in a controller.

---

## 5. Ownership scoping

A new export in `middleware/auth.js`, beside the existing `canManageProperty`:

```js
/**
 * Restrict a lead query to what the caller may see.
 *
 * An administrator sees everything. An agent sees only leads assigned to them —
 * which deliberately excludes unassigned leads (contact-page enquiries, valuation
 * requests), because nobody owns those until an administrator assigns one.
 */
export function scopeLeadQuery(query, user) { ... }

/** Whether this account may read or act on one lead document. */
export function canManageLead(user, lead) { ... }
```

`scopeLeadQuery` is applied **last** when building a list query, so a caller-supplied
`?agent=<someone-else>` can never widen it. `canManageLead` guards the single-document
routes and throws 403 on failure, matching `canManageProperty`'s behaviour.

An agent whose lead has no `agent` set gets 403 — the same answer as a lead belonging to
a colleague.

---

## 6. Email notifications

Three new templates: accept, reject, reschedule.

- Accept → confirmation to the prospect with the scheduled time and the agent's phone.
- Reject → a short decline carrying `responseMessage` when one was given.
- Reschedule → the new time, plus `responseMessage`.

**Targeted cleanup:** `emails/enquiryEmails.js` already holds two viewing templates
(`agentViewingNotification`, `prospectViewingConfirmation`) despite its name. Adding
three more would make the misnaming worse, so this slice creates `emails/viewingEmails.js`
and **moves those two existing templates into it**, updating their importer. The split is
by resource, matching how controllers and routes are already organised. This is the only
refactor in scope.

Rules that carry over from the public lead endpoints:

- **The response is sent before the email.** A slow mail provider must never slow a staff
  member's click, and a mail failure must never roll back a status change.
- Failures are logged at `warn` and swallowed. `RESEND_API_KEY` is currently empty, so
  `emailService` no-ops in development and the endpoints must work regardless.
- No email is sent when the prospect gave no email address — phone is the required field
  on both lead models, email is optional.

---

## 7. Files

**Create:**

| Path | Responsibility |
| --- | --- |
| `controllers/adminEnquiryController.js` | List, stats, detail, update, delete |
| `controllers/adminViewingController.js` | List, detail, update, delete |
| `routes/adminEnquiryRoutes.js` | Mount + per-route authorisation |
| `routes/adminViewingRoutes.js` | Mount + per-route authorisation |
| `utils/viewingTransitions.js` | The state machine, standalone and testable |
| `utils/escapeRegex.js` | Escape user input before it reaches a regex |
| `emails/viewingEmails.js` | Accept / reject / reschedule templates, plus the two viewing templates moved out of `enquiryEmails.js` |
| `tests/api.adminEnquiry.test.js` | Route-level tests |
| `tests/api.adminViewing.test.js` | Route-level tests |
| `tests/viewingTransitions.test.js` | State machine unit tests |

**Modify:**

| Path | Change |
| --- | --- |
| `middleware/auth.js` | Add `scopeLeadQuery` and `canManageLead` |
| `emails/enquiryEmails.js` | Remove the two viewing templates (moved to `viewingEmails.js`) |
| `controllers/enquiryController.js` | Update the import for the two moved templates |
| `app.js` | Mount the two new routers |
| `docs/API-REFERENCE.md` | Document the new endpoints; shrink "Not built yet" |
| `CLAUDE.md` | Update the status block and the endpoint tables |

No new dependencies.

---

## 8. Testing

Vitest + supertest + `mongodb-memory-server`, matching `tests/api.admin.test.js`.

**Ownership (the security surface — most important):**
- An agent listing enquiries sees only their own.
- An agent does **not** see an unassigned enquiry in the list.
- An agent fetching a colleague's enquiry by id gets 403.
- An agent passing `?agent=<colleague id>` still gets only their own — the scope wins.
- An administrator sees all, assigned and unassigned.

**Authorisation:**
- An agent attempting `DELETE` gets 403; an administrator gets 204.
- An agent attempting to set `agent` on a PATCH gets 403.
- An unauthenticated request to any of these gets 401.

**State machine:**
- Every legal transition in §4 succeeds.
- A representative illegal transition (`completed` → `requested`) is 400.
- Re-applying the current status is a no-op, not an error.
- `accepted` with no `scheduledFor` inherits `requestedFor`.
- `rescheduled` with a past `scheduledFor` is 400.
- `rescheduled` with an unchanged `scheduledFor` is 400.

**Behaviour:**
- `stats` returns every status key including zeroes, and is scoped to the caller.
- `notes` is absent from the list response and present on the detail response.
- A PATCH containing `contactedAt` or an unknown field does not write it.
- `q` matches on name, phone and email, and a regex metacharacter in `q` is escaped
  rather than executed.
- Deleting an enquiry actually removes the document (no tombstone with personal data).
- A viewing status change still succeeds when the mail transport throws.

---

## 9. Out of scope

Daily enquiry digest (§4.3), bulk actions, staff management, media upload, content
endpoints, and any admin UI. Each is its own slice.

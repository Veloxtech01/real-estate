# Daily digest of new enquiries — design spec

Date: 2026-09-08

## Problem

Scope doc §4.3 lists three notification requirements: new-enquiry email to the
assigned agent (built), new-viewing-request email (built), and a daily digest of new
enquiries to admin — the one bullet still unbuilt, called out explicitly in
CLAUDE.md's "Not built" line. `enquiryModel.js`'s `{ agent: 1, status: 1, createdAt: -1 }`
index comment already anticipates it ("the Phase 2 agent dashboard **and the daily
digest**"), and the email infrastructure (`emailService.js`, `emails/layout.js`) is
already in the right shape to extend.

## Scope

Backend-only. No frontend change — this is an outbound email, not a UI feature.

Explicitly **out of scope**:

- Viewings. §4.3's digest line names enquiries only; viewing requests already get
  their own immediate agent/prospect emails.
- A CLI/manual-trigger script or external scheduler (Render Cron Job, etc.) — see
  the scheduling decision below.
- Per-agent digests. Only `role: "administrator"` accounts receive this; agents keep
  getting per-lead notifications as today.
- A "heartbeat" email on days with zero new enquiries.

## New dependency: `node-cron`

Flagging per CLAUDE.md. No scheduler exists anywhere in the stack (`package.json` has
no `node-cron`/`node-schedule`/`agenda`/`bull`, confirmed by search) and no deployment
config exists in the repo to hang an external cron job off. `node-cron` is the
smallest addition that gets an in-process daily trigger without new infrastructure —
appropriate for a single-process Express app that's already expected to run
continuously (per the existing graceful-shutdown wiring in `index.js`).

## Backend

### `backend/utils/dailyDigest.js` (new)

Two exported functions, following the `seed.js` composability pattern (plain
functions, no class, easy to call from tests):

```js
// Returns enquiries created since `since`, newest first, with property title/
// reference resolved for display. Covered by the existing
// { status: 1, createdAt: -1 } index.
async function getDigestEnquiries(since) { ... }

// Loads active administrators + the last 24h of enquiries, sends one digest email
// per admin. No-ops (sends nothing) when there are zero new enquiries. Never throws
// — matches "notifications are best-effort" elsewhere in §4.3.
async function sendDailyDigest() { ... }
```

`getDigestEnquiries`:

- Query: `Enquiry.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 })`.
- For each enquiry with a `property` id, look up `title`/`reference` the same way
  `enquiryController.js`'s `resolveProperty` does. Enquiries with no property (e.g.
  `type: "list_property"`/`"general"`) fall back to `requirement.location` (free
  text, populated by the list-your-property form) or, failing that, the enquiry
  `type` alone.
- Selects only fields already open by default on `enquiryModel` (`notes` stays
  excluded, same as every other read path).

`sendDailyDigest`:

- `since = new Date(Date.now() - 24 * 60 * 60 * 1000)`.
- `Agent.find({ role: "administrator", isActive: true }).select("name email")`.
- If `getDigestEnquiries(since)` returns an empty array, return immediately — no
  email sent, no admin query needed (short-circuit before the `Agent.find`).
- Otherwise, for each admin: build `adminDailyDigest({ enquiries, agencyName,
  clientUrl })` from the new template and call `sendEmail({ to: admin.email, ...})`
  from `emailService.js` (already non-throwing/best-effort — a bad `RESEND_API_KEY`
  logs and returns `{ sent: false }` rather than crashing the cron tick).
- `agencyName` comes from `Settings.get()` (same source every other email uses);
  `clientUrl` from `process.env.CLIENT_URL` (already read in `app.js` for CORS, so
  no new env var).
- Whole function body wrapped in try/catch with `logger.error` on failure — a digest
  bug must never take down the scheduled tick or the server.

### `backend/emails/digestEmails.js` (new)

Same shape as `enquiryEmails.js`/`viewingEmails.js` — plain template-string
functions through `layout()`/`escape()`, no HTML table, phone-readable:

```js
// Takes: { enquiries, agencyName, clientUrl }. Returns: { subject, html }.
function adminDailyDigest({ enquiries, agencyName, clientUrl }) { ... }
```

- Subject: `` `Daily digest: ${enquiries.length} new ${enquiries.length === 1 ? "enquiry" : "enquiries"}` ``.
- Body: one compact block per enquiry — name, `type` (humanised), property
  title/reference or fallback location, relative "submitted" time (reuse
  `formatWhen` from `layout.js`) — each linking to
  `` `${clientUrl}/admin/enquiries?id=${enquiry._id}` ``, matching the inbox's
  existing `?id=` URL-as-state convention so the link opens the exact row.
- No WhatsApp link here (that's the per-enquiry agent notification's job, not a
  summary digest's).

### Scheduling — `backend/index.js`

Registered next to the existing server bootstrap/graceful-shutdown code, not buried
in a controller:

```js
import cron from "node-cron";
import { sendDailyDigest } from "./utils/dailyDigest.js";

// §4.3 daily digest — 7:00 AM WAT (Africa/Lagos), independent of host server tz.
cron.schedule("0 7 * * *", () => { void sendDailyDigest(); }, {
  timezone: "Africa/Lagos",
});
```

`void` because `sendDailyDigest` handles its own errors internally — the cron
callback has nothing to catch.

## Testing

Backend (vitest + supertest + mongodb-memory-server, matching every other suite):

- `dailyDigest.test.js`:
  - `getDigestEnquiries` returns only enquiries with `createdAt >= since`, newest
    first; excludes older ones.
  - An enquiry with a `property` ref resolves title/reference; one without falls
    back to `requirement.location`, then to `type`.
  - `sendDailyDigest` with zero qualifying enquiries sends no email (assert the
    admin query itself is never reached, or at minimum that `sendEmail` is never
    called).
  - `sendDailyDigest` with N qualifying enquiries sends exactly one email per active
    administrator, and zero to `role: "agent"` or `isActive: false` accounts.
  - A `sendEmail` rejection/failure for one admin doesn't stop the others (loop
    isolation) and doesn't throw out of `sendDailyDigest`.
- `digestEmails.test.js`: `adminDailyDigest` output contains each enquiry's name and
  the correct `?id=` link; escapes untrusted enquiry fields (name/message) via
  `escape()`, same assertion style as the existing email template tests.
- No test for the `node-cron` registration itself — `index.js` isn't covered by the
  existing suite (it's the process entry point, same reason `app.js`'s `createApp()`
  is what's tested instead); the schedule expression is simple enough to verify by
  reading it.

## Status doc updates (on completion)

- CLAUDE.md status block: replace "**Not built:** the §4.3 daily digest." with a
  bullet describing what shipped (in-process `node-cron`, 7 AM WAT, administrators
  only, skips empty days) — closing the last open item in that list.
- CLAUDE.md's backend conventions/layout section: no structural change (no new
  top-level folder — the job lives in `utils/` + `emails/`, registered from
  `index.js`), but note `node-cron` in the backend dependency list alongside
  `resend`/`winston`.
- `backend/.env.example`: no new var — reuses `CLIENT_URL`, `RESEND_API_KEY`,
  `MAIL_FROM`, `MONGODB_URI` which all already exist.
- `docs/API-REFERENCE.md`: no change — no HTTP endpoint added.
- `docs/PROJECT-SCOPE.md`: no change — this closes an existing §4.3 bullet rather
  than deviating from it.

# Staff management: admin CRUD for agents

**Date:** 2026-09-06
**Status:** Approved, not yet implemented

Closes the "staff management" line in CLAUDE.md's "Not built" list. `agentModel` is
fully specified and already serves both a staff login and a public team profile
(`GET /api/agents`), but there is no way to create, edit, or deactivate one except the
seed script or a direct database write.

---

## Scope and the one governing constraint

Administrator-only, per §7 ("staff" is listed only under the Administrator row). Agents
never see this surface, in the UI or the API.

**No hard delete of an `Agent` document, ever.** `propertyModel.agent`,
`enquiryModel.agent`, `viewingModel.agent`, and `testimonialModel.agent` all reference
it. Deleting one would orphan every listing, lead, and testimonial that account ever
touched — the same reasoning that already makes property deletion soft, except here
there is no `deletedAt` to restore from; the record itself is load-bearing elsewhere in
the database. "Remove an agent" means **deactivate** (`isActive: false`), which the
model already has and which `login` already checks.

**Explicitly deferred:**
- An agent editing their own profile. §7 grants this, but it's a self-service surface
  (acting on your own account) rather than an admin-of-others one, and nothing in the
  current admin panel has that shape yet (`/api/auth/change-password` is the closest
  precedent, and it only covers the password). Separate slice.
- Any finer-grained permission model. "Assign roles" is exactly the existing
  `administrator`/`agent` enum plus the `canPublish` flag — there is nothing else to
  assign.
- Email-based invite or password-reset flow. The initial password is admin-typed (see
  below), consistent with there being no email/reset-token infrastructure in this
  project at all today.

---

## Backend

**`backend/controllers/adminStaffController.js`** + **`backend/routes/adminStaffRoutes.js`**,
mounted at `/api/admin/staff`. `requireAuth` and `authorizeRole("administrator")` are
applied at the router level — the whole router is administrator-only, so a route added
later here can't end up unprotected by omission (same pattern as `adminReferenceRoutes`).

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Full roster, **active and inactive** — an admin has to be able to find someone to reactivate. Public field whitelist plus `isActive`, `role`, `canPublish`, `email`; never `password`. |
| GET | `/:id` | One record, for the edit form. Same projection. |
| POST | `/` | Create. |
| PATCH | `/:id` | Update, including deactivate/reactivate and a password reset. |

**Create — required:** `name`, `email`, `password` (≥8 chars, same check as
`change-password`), `role`. **Optional:** `phone`, `whatsapp`, `position`, `bio`,
`photo`, `areas`, `registrationNumber`, `canPublish`, `isPublic`. `isActive` is not
client-settable on create — every new account starts active. `slug` is server-derived
from `name` via a new `uniqueAgentSlug(name)` helper in `utils/slugify.js`: `slugify(name)`,
and if that value is already taken, append `-2`, `-3`, … until it isn't. A duplicate
`email` surfaces as the existing 409 duplicate-key handling in the global error
handler — no new logic needed for that case.

**Update — same writable set, plus:**
- `password` (optional) — an admin-driven reset. Assigning it re-runs the model's
  existing pre-save hash hook; the controller never hashes directly.
- `isActive` (optional).
- If `name` changes, the slug regenerates through the same `uniqueAgentSlug` helper —
  matching `updateProperty`'s existing behaviour of re-slugging on a title change. The
  public profile URL moving when a name is corrected is accepted precedent here, not a
  new decision.

**Guard: an administrator cannot deactivate or demote their own account.** If
`req.params.id === String(req.user._id)` and the request would set `isActive: false` or
`role` to anything other than `"administrator"`, throw `ApiError(400, ...)` with a
message naming the reason. This is the one thing standing between a single-admin agency
and locking themselves out entirely, and it is cheap to check without a
"how many admins are left" query.

**`GET /api/admin/reference`** gains one field: `staffRoles: STAFF_ROLES`. Every other
admin dropdown already reads its options from this endpoint rather than hardcoding a
copy (CLAUDE.md's "enum lists are never mirrored" rule); the role `<select>` on the new
staff form is no exception.

---

## Frontend

**`lib/api/admin.js`** gains four wrappers, following the existing property ones
exactly: `getStaff()`, `getStaffMember(id)`, `createStaffMember(body)`,
`updateStaffMember(id, body)`.

**`/admin/staff`** — `StaffTable.jsx`: name, email, role, position, an active/inactive
badge. Same `useAdminResource` + URL-state discipline as `PropertyTable` (filters in the
URL, resets to page 1 on filter change). Deactivate/reactivate replaces delete/restore,
each behind `ConfirmDialog`. The confirmation copy must say "deactivate" and
"reactivate," never "delete" — this action is fully reversible and the wording has to
say so, the same distinction CLAUDE.md already draws between soft-deleting a listing and
permanently erasing a lead.

**`/admin/staff/new`** and **`/admin/staff/[id]`** — one `StaffForm.jsx` handles both,
mirroring `PropertyForm`'s create/edit split (a `staffMember` prop present or absent).
Password field: required on create; on edit, optional and labelled "leave blank to keep
the current password" — an empty string must not be sent as the new password.

**`AdminSidebar`** gains a "Staff" nav item, rendered only when
`user.role === "administrator"`. Courtesy, not security, per the existing convention —
the API's `authorizeRole` is what actually blocks an agent; this just keeps a control
they cannot use out of their view.

---

## Testing

**Backend** (`backend/tests/api.adminStaff.test.js`, mirroring `api.adminReference.test.js`
/ `api.admin.test.js` conventions):

- an agent gets 403 on every route under `/api/admin/staff`
- create hashes the password (never stores or returns plaintext) and rejects a
  duplicate email with 409
- two agents named identically get distinct slugs (`-2` suffix)
- an administrator cannot deactivate their own account, and cannot demote themselves
  away from `administrator`
- update never returns `password` in the response body
- the list includes inactive accounts; the public `/api/agents` endpoint still excludes
  them (regression guard — this slice must not loosen that endpoint)

**Frontend:**

- `StaffTable` renders the roster including inactive rows with a visible state badge
- `StaffForm` submits the create payload with a required password, and the edit payload
  omits `password` entirely when the field is left blank
- the "Staff" nav item is present for an administrator session and absent for an agent
  session

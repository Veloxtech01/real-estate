# Settings admin — design spec

Date: 2026-09-06

## Problem

`settingsModel` (the site-config singleton — agency identity, contact details, theme
branding, AI search operational controls, compliance/analytics ids) exists and is read
via `Settings.get()`, but nothing lets an administrator change it except a direct
database write. This closes that gap with an admin UI, following the Staff/Blog
precedent already in the codebase.

## Scope

All groups of the singleton are covered in v1: agency identity, contact/social/office
hours, theme/branding, AI search controls, compliance, analytics ids.

Explicitly **out of scope** for this pass:

- Logo/favicon runtime wiring (`Header`/`Footer` still render `siteConfig`'s text logo;
  swapping to an uploaded image affects the static `favicon.ico` convention too — a
  separate, larger change).
- Font (`fontHeading`/`fontBody`) runtime wiring — `next/font` self-hosts Playfair
  Display + Inter at build time; swapping to an arbitrary Google Font at runtime needs a
  different loading strategy (e.g. a dynamic `<link>`), which drops the zero-layout-shift
  guarantee CLAUDE.md's next/font note exists to protect. The fields stay in the form,
  editable and stored, explicitly captioned as not yet applied.
- Manual reset of `aiSearch.currentSpendUsd` — read-only display only; a reset action
  belongs with the (also not-yet-built) billing-period job / daily digest scheduler.
- Editing the 7 non-core color tokens (`muted`, `taupe`, `border`, `text`, `success`,
  `warning`, `danger`) — status/structural colors, not brand identity a client rebrand
  changes.

## Backend

### `backend/controllers/adminSettingsController.js` (new)

Mirrors `adminStaffController.js`'s shape: a `WRITABLE_FIELDS` allow-list, a
`pickWritable()` helper, no `POST`/`DELETE` (the singleton always exists via
`Settings.get()`).

```
WRITABLE_FIELDS = [
  "agencyName", "tagline", "lasreraNumber", "registrationNumbers",
  "email", "phone", "whatsapp", "address", "coordinates", "officeHours",
  "socialLinks", "footerText", "listingDisclaimer", "ndpcRegistrationNumber",
  "googleAnalyticsId", "googleSearchConsoleId",
]
```

`theme` and `aiSearch` are handled separately from the flat allow-list because they're
sub-objects that must be **deep-merged**, not replaced — a partial theme PATCH (e.g.
just `theme.colors.accent`) must not wipe `theme.homepageVariant` or drop
`theme.fontHeading`; a partial `aiSearch` PATCH must never touch `currentSpendUsd`.

- `theme` writable keys: `colors` (object, keys restricted to the 9 core tokens: `ink`,
  `ink-deep`, `ink-raised`, `ink-soft`, `accent`, `accent-text`, `accent-hover`,
  `surface`, `surface-raised`), `logoUrl`, `logoDarkUrl`, `faviconUrl`, `fontHeading`,
  `fontBody`. `homepageVariant` is **not** writable here — no UI reads/needs it yet.
- `aiSearch` writable keys: `enabled`, `monthlySpendCapUsd`, `timeoutMs`. `currentSpendUsd`
  is never accepted even if present in the body — silently dropped, same as any other
  unlisted field.

**`GET /api/admin/settings`** — `Settings.get()`, sends the full document (unlike the
curated public projection in `getPublicSettings`, the admin sees everything including
`aiSearch.currentSpendUsd`, `monthlySpendCapUsd`, `ndpcRegistrationNumber`,
`googleAnalyticsId`).

**`PATCH /api/admin/settings`**:

1. Validate: `agencyName` non-empty if present in the merge result (the doc-level
   `required` already guards this, but a field-level 400 is friendlier than a 500);
   `email` matches a basic email shape if present and non-empty; each `theme.colors`
   value matches `/^#[0-9a-f]{3,8}$/i` if present; `aiSearch.monthlySpendCapUsd` and
   `aiSearch.timeoutMs` are non-negative numbers if present. Field errors collect into
   one `ApiError(400, "Invalid settings", fieldErrors)`, dotted paths
   (`"theme.colors.accent"`, `"aiSearch.monthlySpendCapUsd"`) so
   `lib/apiErrors.js` can map them to nested inputs the same way it already does for the
   listing editor.
2. `const settings = await Settings.get();`
3. `settings.set(pickWritable(req.body))` for the flat fields.
4. For `theme`: `settings.set({ theme: { ...settings.theme.toObject(), ...pickWritableTheme(req.body.theme) } })` (object spread merge, colors sub-key merged the same way) — never `settings.theme = req.body.theme`.
5. Same merge pattern for `aiSearch`, explicitly excluding `currentSpendUsd` from the
   merge source.
6. `await settings.save()`.
7. Send `{ success: true, data: { settings } }` — full document, matching GET.

### `backend/routes/adminSettingsRoutes.js` (new)

```js
router.use(requireAuth, authorizeRole("administrator"));
router.get("/", getSettings);
router.patch("/", updateSettings);
```

Mounted at `/api/admin/settings` in `app.js`, alongside the other `/api/admin/*` routers.

## Frontend

### `frontend/src/lib/api/admin.js` — additions

```js
export async function getAdminSettings() { ... }   // GET /admin/settings → data.settings
export async function updateAdminSettings(patch) { ... } // PATCH /admin/settings → data.settings
```

### `frontend/src/app/admin/(panel)/settings/page.js` (new)

Client component (matches the rest of the admin panel), loads via `useAdminResource`
(discard-stale-response pattern), renders `<SettingsForm settings={settings} onSaved={refetch} />`.

### `frontend/src/components/admin/SettingsForm.jsx` (new)

One `react-hook-form` form (`defaultValues` from the loaded settings document), one Save
button, no tabs/wizard — same reasoning as the listing editor: a validation error on a
section the admin isn't looking at must not go unnoticed. Sections, in order:

1. **Agency identity** — `agencyName`, `tagline`, `lasreraNumber`,
   `registrationNumbers` as a `useFieldArray` (add/remove rows, each `{ body, number }`).
2. **Contact** — `email`, `phone`, `whatsapp`, `address`; `officeHours` as 7 fixed rows
   (Monday–Sunday, each `opensAt`/`closesAt`/`isClosed` checkbox that disables the time
   inputs when checked); `socialLinks` as 6 fixed fields (facebook, instagram, x,
   linkedin, youtube, tiktok).
3. **Branding** — the 9 core color tokens, each a paired `<input type="color">` +
   hex `<input type="text">` kept in sync (editing either updates both); `fontHeading`/
   `fontBody` as plain text fields with a caption: "Stored, not yet applied to the live
   site — font rendering needs a separate loading-strategy change"; `logoUrl`,
   `logoDarkUrl`, `faviconUrl` as URL text fields, each showing a live `<img>` preview
   when a value is present.
4. **AI search controls** — `aiSearch.enabled` toggle, `aiSearch.monthlySpendCapUsd`
   (number, USD), `aiSearch.timeoutMs` (number, ms); `currentSpendUsd` rendered as
   read-only text: "$X.XX of $Y.YY spent this month" (not a form field — never submitted).
5. **Compliance & analytics** — `listingDisclaimer` (textarea), `ndpcRegistrationNumber`,
   `googleAnalyticsId`, `googleSearchConsoleId`.

On submit: build a patch object of only the fields react-hook-form reports as dirty
(`formState.dirtyFields`), call `updateAdminSettings(patch)`, `toast.success("Settings
saved")` on success, call `onSaved()`. A 400's `details` map onto fields via the existing
`lib/apiErrors.js` helper; anything with no matching field goes to a form-level banner.

### `frontend/src/components/admin/AdminSidebar.jsx`

Add `{ href: "/admin/settings", label: "Settings", icon: FiSettings }` to the
administrator-only block, alongside Blog and Staff.

## Theme color runtime wiring

`frontend/src/app/layout.js`'s `RootLayout` becomes an `async function`, fetches
`Settings` server-side through `frontend/src/lib/api/server.js` (the fetch-based client
— this is a Server Component, so no Axios instance here). If `theme.colors` has any of
the 9 core token keys set, render one inline `<style>` tag in `<head>`, immediately after
`globals.css`'s effect, containing only the overridden custom properties:

```html
<style>:root{--color-accent:#c6a15b;--color-ink:#0d1b2a;/* ...only set keys... */}</style>
```

Unset tokens are omitted entirely, so they fall through to `globals.css`'s `@theme`
defaults untouched. This is pure CSS — no JS, no hydration mismatch risk — and applies
site-wide (public pages **and** admin chrome), which is correct: admin components already
consume `--color-accent`/`--color-ink`/etc. via Tailwind utility classes
(`bg-accent/10`, `text-ink-soft`, …), so a client rebrand should recolor both, even
though the admin's *layout* (Section tone, hero treatment) stays deliberately excluded
from the marketing restyle.

If `Settings.get()`'s fetch fails (DB unreachable at boot), the layout renders with no
override — falls back to `globals.css` defaults, matching how `Settings.get()`
self-creates a default document rather than the app failing to boot.

## Testing

**Backend** (vitest + supertest + mongodb-memory-server):

- `GET /api/admin/settings` — 401 unauthenticated, 403 for an `agent` role, 200 with the
  full document (including `aiSearch.currentSpendUsd`) for an administrator.
- `PATCH /api/admin/settings` — 403 for an agent; a flat-field update persists; a
  `theme.colors` partial update doesn't clobber `theme.fontHeading` or
  `theme.homepageVariant`; an `aiSearch` partial update doesn't touch
  `currentSpendUsd` even when the body includes it; invalid email / negative spend cap /
  malformed hex color each return 400 with dotted-path `details`; unlisted fields
  (`key`, `_id`, `createdAt`) are silently dropped, not errors.

**Frontend** (vitest + Testing Library):

- `SettingsForm` renders all five sections from a loaded settings fixture.
- Submitting with only one field changed sends a patch containing just that field.
- A mocked 400 with `details: { "theme.colors.accent": "..." }` renders the error next
  to the accent color input.
- `officeHours` `isClosed` toggle disables that row's time inputs.

`RootLayout`'s style injection is a Server Component and isn't covered by Vitest (per
CLAUDE.md's existing note that SSR isn't covered by these tests) — verified manually:
change `theme.colors.accent` via the new form, reload the public site and `/admin`, and
confirm the gold accent shifted in both.

## Status doc updates (on completion)

- CLAUDE.md status block: move "settings admin" out of the "Not built" list; add a
  bullet describing what shipped (mirroring the Staff/Blog bullets), noting the
  logo/favicon/font wiring deferral explicitly so a future session doesn't assume it's
  done.
- `docs/API-REFERENCE.md`: add `GET/PATCH /api/admin/settings` with real captured
  response shapes, and note in its "Not built yet" list that logo/favicon/font are
  stored but inert.

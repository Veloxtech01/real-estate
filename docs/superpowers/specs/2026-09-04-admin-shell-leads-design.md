# Admin Panel — Shell and Lead Operations (Design)

Date: 2026-09-04
Scope: Sub-project A of the admin panel — authentication, the admin shell, the enquiry
inbox and the viewing diary. The listing table and editor are a separate spec.

---

## 1. Why this slice, and why not more

The admin panel is four modules: auth + shell, listings, enquiry inbox, viewing diary.
The listing editor alone covers ~25 writable fields including nested `price`, `rent`,
`infrastructure` and `coordinates` objects — larger than the other three combined.

Splitting it out means the shell's patterns (session, fetching, role gating, error
handling) get proved against two simple list/detail/update screens before the heavy form
is written against them.

Every endpoint this slice needs already exists. Nothing here is blocked.

---

## 2. Decision record

| Decision | Choice | Reason |
| --- | --- | --- |
| Rendering | **Client components + the existing Axios instance** | The admin has no SEO need and sits behind a cookie. `lib/api/client.js` already carries `withCredentials` and a 401 interceptor built for exactly this. Server components would need cookie forwarding on every fetch and make each route dynamic anyway |
| Inbox and diary layout | **Master-detail**, selection in `?id=` | Working a backlog means staying on one screen. Keeping selection in the URL preserves shareability and the back button, which a pure client-state panel loses |
| Route protection | **Three layers** (proxy → session provider → API 401) | Next 16's docs are explicit that Proxy is for optimistic checks, not authorization |
| Data fetching | **A local `useAdminResource` hook** | TanStack Query would be a new dependency for four screens. CLAUDE.md requires new dependencies to be flagged, and this scope doesn't earn one |
| Dashboard | **Kept**, at `/admin` | `GET /api/admin/enquiries/stats` exists and a landing screen is where a staff member orients. It is small — stat tiles and an upcoming-viewings strip |
| Visual register | Same tokens, **denser than the public site** | An editorial admin panel wastes a working screen |
| Listing management | **Out of scope** | Its own spec |

---

## 3. Routes

All under `src/app/admin/`, all client components.

| Route | Purpose |
| --- | --- |
| `/admin/login` | Email + password. Redirects to `/admin` when already signed in |
| `/admin` | Dashboard: enquiry counts by status, upcoming viewings |
| `/admin/enquiries` | Master-detail inbox; `?id=` selects, `?status=` etc. filter |
| `/admin/viewings` | Master-detail diary; same URL conventions |

`/admin/login` sits **outside** the authenticated layout — it must render without a
session. The other three share `app/admin/(panel)/layout.js`, which mounts the sidebar
and the session provider.

---

## 4. Authentication — three layers, none sufficient alone

**Layer 1 — `src/proxy.js`.** Next 16 renamed Middleware to Proxy; the file lives at
`src/proxy.js` beside `app/`. It checks only that the `re_token` cookie *exists* and
redirects to `/admin/login` when it doesn't.

This is an **optimistic check**, exactly as the Next 16 docs prescribe: it cannot verify
the token (the signing key is the backend's) and must not try. Its only job is avoiding a
flash of empty admin chrome before the session call resolves. A forged cookie gets past it
and is then rejected by the API.

**Layer 2 — `AdminSessionProvider`.** A client provider in the authenticated layout that
calls `GET /api/auth/me` once on mount and exposes `{ user, loading, refresh, signOut }`.
While `loading`, the layout renders a skeleton rather than children — otherwise every
screen would flicker through a "no permissions" state before the user arrives.

On a 401 from that call it redirects to `/admin/login`.

**Layer 3 — the API, which is the actual gate.** `requireAuth` re-loads the account on
every request rather than trusting the JWT, so a deactivated or demoted staff member loses
access on their next action rather than in up to seven days. The frontend cannot weaken
this and must not duplicate it.

The Axios interceptor in `lib/api/client.js` gains one behaviour: on a 401 outside the
login page, redirect to `/admin/login`. Handled once, in the interceptor — never per call
site.

**Sign-out** posts to `/api/auth/logout`, clears provider state, and navigates to the
login page.

---

## 5. Data fetching

`src/hooks/useAdminResource.js`:

```js
const { data, loading, error, refetch } = useAdminResource(fetcher, deps);
```

- `fetcher` is an async function returning the unwrapped `data` object.
- Re-runs when `deps` change — the filter object, in practice.
- Tracks a request sequence internally and ignores a stale response, so fast filter
  changes can't render an older result over a newer one.
- `error` is the normalised Error the interceptor produces, carrying `message` and
  `details`.

Mutations do not go through this hook. A status change calls the API directly, then
`refetch()`. Optimistic updates are deliberately omitted: a lead pipeline is low-frequency
and a wrong optimistic state on a lead is worse than a 200ms wait.

`src/lib/api/admin.js` holds the typed call wrappers so no screen builds a URL inline:
`login`, `logout`, `getMe`, `getEnquiries`, `getEnquiryStats`, `getEnquiry`,
`updateEnquiry`, `deleteEnquiry`, `getViewings`, `getViewing`, `updateViewing`,
`deleteViewing`.

---

## 6. Screens

### 6.1 Login

Email and password via `react-hook-form`. One generic error for any failure — the API
deliberately does not distinguish "wrong password" from "no such account", and the UI must
not undo that by wording them differently.

Login is throttled to 10 failures per 15 minutes; a 429 gets its own message telling the
user to wait, not a generic failure.

### 6.2 Dashboard

Stat tiles from `GET /api/admin/enquiries/stats` — one per status plus a total, each
linking into the inbox pre-filtered. Below them, the next few upcoming viewings from
`GET /api/admin/viewings?upcoming=true&limit=5`.

Both are already scoped to the caller by the API, so an agent's dashboard shows their own
numbers with no frontend filtering.

### 6.3 Enquiry inbox

Master-detail. The list column shows name, property, status badge and relative time. The
detail column shows the full record, contact actions, and the editable controls.

- **Selection lives in `?id=`.** Filters live in the URL too (`?status=`, `?q=`,
  `?type=`), reusing the public site's URL-as-state discipline.
- Status is a select; saving calls `PATCH` then `refetch()`.
- Notes is a textarea saved with the status.
- Call and WhatsApp buttons mirror the public `AgentCard` — phone is the primary channel.
- **`agent` reassignment renders only for administrators.** The API returns 403 for an
  agent regardless; hiding it is courtesy, not security.
- **Delete renders only for administrators**, behind a confirmation that states the
  deletion is permanent and irreversible — because it is a hard delete for NDPA erasure,
  unlike the soft delete on listings.

### 6.4 Viewing diary

Same master-detail shell, different content and controls.

- Defaults to `?upcoming=true`, sorted soonest-first, matching the API's own ordering.
- The detail panel offers only the transitions the API will accept from the current
  status, read from a table mirroring `utils/viewingTransitions.js`. A terminal status
  (`rejected`, `completed`, `cancelled`) shows no controls at all.
- **Accept** submits without a date by default — the API inherits `requestedFor` — with an
  optional "propose a different time" field.
- **Reschedule** requires a future date-time different from the current one. The form
  validates this client-side for a fast error, but the API is the authority and its 400 is
  surfaced verbatim if the two ever disagree.
- **Reject** takes a `responseMessage`, which the prospect receives by email.

> The transition table is duplicated between backend and frontend. That is deliberate and
> the direction of authority is one-way: the frontend copy decides which *buttons render*,
> the backend copy decides what is *allowed*. If they drift, the API wins and the user sees
> its 400. Do not invert this by trusting the frontend table.

---

## 7. Shell and layout

`app/admin/(panel)/layout.js` mounts:

- `AdminSessionProvider`
- `AdminSidebar` — Dashboard, Enquiries, Viewings, plus a Listings entry that is present
  but disabled until that slice lands. Collapses to a top bar with a drawer under `lg`.
- A header strip with the signed-in user's name, role, and sign-out.

The public `Header` and `Footer` must not render inside `/admin`. The current root layout
mounts them unconditionally, so this slice moves them into a `(site)` route group holding
the public pages, leaving `/admin` with its own chrome. That is the only structural change
to existing frontend code.

Two consequences of that move, both easy to get wrong:

- **`sitemap.js` and `robots.js` stay at `app/` root**, not inside `(site)`. They are file
  conventions tied to the application root, and moving them risks them not being emitted.
- **`app/not-found.js` renders outside every route group's layout**, so once `Header` and
  `Footer` live in `(site)/layout.js`, the global 404 loses the site chrome. It must
  therefore be moved to `app/(site)/not-found.js` so a bad public URL still shows the
  header and footer. The same applies to `app/error.js`. A 404 stripped of navigation is a
  dead end for a visitor who mistyped a listing URL — which is the exact case that page
  exists for.

---

## 8. Files

**Create:**

| Path | Responsibility |
| --- | --- |
| `frontend/src/proxy.js` | Optimistic cookie check for `/admin/*` |
| `frontend/src/lib/api/admin.js` | Typed admin API wrappers |
| `frontend/src/hooks/useAdminResource.js` | Fetch/loading/error/refetch with stale-response guarding |
| `frontend/src/components/admin/AdminSessionProvider.jsx` | Session context |
| `frontend/src/components/admin/AdminSidebar.jsx` | Navigation |
| `frontend/src/components/admin/MasterDetail.jsx` | The shared two-column shell |
| `frontend/src/components/admin/StatusSelect.jsx` | Status control used by both modules |
| `frontend/src/components/admin/ConfirmDialog.jsx` | Destructive-action confirmation |
| `frontend/src/components/admin/EnquiryList.jsx` · `EnquiryDetail.jsx` | Inbox halves |
| `frontend/src/components/admin/ViewingList.jsx` · `ViewingDetail.jsx` | Diary halves |
| `frontend/src/lib/viewingTransitions.js` | Frontend copy of the transition table |
| `frontend/src/app/admin/login/page.js` | Login |
| `frontend/src/app/admin/(panel)/layout.js` | Authenticated shell |
| `frontend/src/app/admin/(panel)/page.js` | Dashboard |
| `frontend/src/app/admin/(panel)/enquiries/page.js` | Inbox |
| `frontend/src/app/admin/(panel)/viewings/page.js` | Diary |

**Modify:**

| Path | Change |
| --- | --- |
| `frontend/src/lib/api/client.js` | Redirect to `/admin/login` on a 401 outside the login page |
| `frontend/src/app/layout.js` | Remove `Header`/`Footer`; they move to the `(site)` group |
| `frontend/src/app/(site)/layout.js` | **New** — public chrome |
| Public pages | Move into `app/(site)/` — URLs are unchanged by a route group. Covers `page.js`, `properties/`, `property/`, `not-found.js` and `error.js`; **`sitemap.js` and `robots.js` stay at `app/` root** |
| `CLAUDE.md` | Document the admin conventions and the route-group split |

No new dependencies.

---

## 9. Testing

Vitest + Testing Library. Vitest does not run the Next compiler, so `proxy.js`, routing
and route groups are **not** covered — they are verified by running the app.

- `useAdminResource` — resolves data, surfaces an error, refetches on dep change, and
  **ignores a stale response that resolves after a newer one**.
- `AdminSessionProvider` — renders children once resolved; renders nothing while loading;
  redirects on a 401.
- `viewingTransitions` (frontend copy) — the allowed sets match the backend table exactly,
  asserted case by case, and terminal statuses yield no actions.
- `EnquiryDetail` — renders a lead; the reassign and delete controls are absent for an
  agent and present for an administrator; a status change calls the API and refetches;
  a `details` payload maps onto the offending field.
- `ViewingDetail` — offers only legal transitions for the current status; reschedule
  rejects a past date; accept submits with no date.
- Login — a failed sign-in shows one generic message; a 429 shows the throttling message.

---

## 10. Out of scope

The listing table and editor, staff management, settings admin, media upload, blog, and
the §4.3 daily digest. Notifications inside the panel (a live badge for new leads) are also
out — they need polling or websockets, neither of which this slice justifies.

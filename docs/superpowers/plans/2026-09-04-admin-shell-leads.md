# Admin Shell and Lead Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated admin panel — login, shell, dashboard, enquiry inbox and viewing diary — against the admin APIs that already exist.

**Architecture:** A `(site)` / `admin` route-group split so public chrome stops leaking into the panel. Admin screens are Client Components fetching through the existing Axios instance, which already carries `withCredentials` and a normalising 401 interceptor. Auth is three layers: an optimistic cookie check in Next 16's `proxy.js`, a session provider calling `/api/auth/me`, and the API itself as the only real gate. Inbox and diary are master-detail screens whose selection and filters live in the URL.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2, Tailwind v4, Axios, react-hook-form, react-hot-toast, react-icons. Tests: Vitest + Testing Library + `@testing-library/user-event`. No new dependencies.

## Global Constraints

- **Read Next 16 docs before writing Next-specific code** — `frontend/node_modules/next/dist/docs/01-app/`. Confirmed facts: **Middleware is renamed Proxy** in Next 16 (`src/proxy.js`, named `proxy` export plus `config.matcher`); Proxy is for **optimistic checks only**, never authorization; route groups `(name)` do **not** affect the URL.
- **Tailwind v4, not v3.** No `tailwind.config.js`; tokens are `@theme` in `src/app/globals.css`.
- **React 19.** No `import React` for JSX. `ref` is a plain prop — no `forwardRef`.
- **Every component, hook and non-obvious branch gets a comment** explaining *why*, per CLAUDE.md. Comment JSX layout regions, conditional renders and mapped lists.
- **No brand colour, font, logo or the agency name hardcoded in a component.** Colours come from the CSS custom properties; everything else from `src/config/site.js`.
- **No new dependencies.** `@testing-library/user-event` is already installed.
- **Never call bare `axios.*` at a call site** — go through `src/lib/api/client.js`, and reach the API only via the wrappers in `src/lib/api/admin.js`.
- **Response envelope is `{ success, data }` / `{ success, message, details? }`.** The interceptor already normalises failures into an `Error` carrying `message`, `status` and `details`. No screen parses the envelope.
- **Use `<Link>` for internal navigation**, never a raw `<a href>`. Icons come from `react-icons/fi`, imported per icon. No emoji as icons.
- **Accessibility floors:** 4.5:1 text contrast, visible `focus-visible` ring, ≥44×44px touch targets, real `<label for>` on every input, `aria-label` on icon-only buttons.
- **The API is the authority on permissions.** Hiding a control from an agent is courtesy; the endpoint enforces it regardless. Never treat a hidden control as a security measure.
- **Lint and test after every task:** `npm run lint` and `npm test` inside `frontend/` must both pass before committing.
- Spec: `docs/superpowers/specs/2026-09-04-admin-shell-leads-design.md`. API contract: `docs/API-REFERENCE.md`.

### Running it

```bash
cd backend && npm run dev     # port 5000, dev DB is seeded
cd frontend && npm run dev    # port 3000
```

Admin credentials are `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/proxy.js` | Optimistic cookie check for `/admin/*` |
| `src/app/(site)/layout.js` | Public chrome — Header, main, Footer |
| `src/lib/api/admin.js` | Typed admin API wrappers; the only place admin URLs are written |
| `src/lib/viewingTransitions.js` | Frontend copy of the transition table — decides which buttons render |
| `src/hooks/useAdminResource.js` | Fetch/loading/error/refetch with stale-response guarding |
| `src/components/admin/AdminSessionProvider.jsx` | Session context |
| `src/components/admin/AdminSidebar.jsx` | Navigation + sign-out |
| `src/components/admin/MasterDetail.jsx` | Shared two-column shell |
| `src/components/admin/StatusSelect.jsx` | Status control |
| `src/components/admin/ConfirmDialog.jsx` | Destructive-action confirmation |
| `src/components/admin/EnquiryList.jsx` · `EnquiryDetail.jsx` | Inbox halves |
| `src/components/admin/ViewingList.jsx` · `ViewingDetail.jsx` | Diary halves |
| `src/app/admin/login/page.js` | Login, outside the authenticated layout |
| `src/app/admin/(panel)/layout.js` | Authenticated shell |
| `src/app/admin/(panel)/page.js` | Dashboard |
| `src/app/admin/(panel)/enquiries/page.js` | Inbox |
| `src/app/admin/(panel)/viewings/page.js` | Diary |

**Moved** (route group; URLs unchanged): `app/page.js`, `app/properties/`, `app/property/`, `app/not-found.js`, `app/error.js` → `app/(site)/`.

**Stay at `app/` root:** `sitemap.js`, `robots.js`, `globals.css`, `favicon.ico`, `layout.js`.

**Modified:** `src/app/layout.js` (chrome removed), `src/lib/api/client.js` (401 redirect), `CLAUDE.md`.

---

## Task 1: Route-group split

The root layout mounts `Header`/`Footer` unconditionally, so the public chrome would render inside `/admin`. Route groups fix this without changing a single URL.

**Files:**
- Create: `frontend/src/app/(site)/layout.js`
- Move: `app/page.js`, `app/properties/`, `app/property/`, `app/not-found.js`, `app/error.js` → `app/(site)/`
- Modify: `frontend/src/app/layout.js`

**Interfaces:**
- Consumes: `Header`, `Footer` (already built).
- Produces: a root layout carrying only `<html>`, `<body>`, fonts, JSON-LD and `<Toaster />`; a `(site)` layout carrying the public chrome.

- [ ] **Step 1: Move the public routes into the group**

```bash
cd frontend/src/app
mkdir -p "(site)"
git mv page.js "(site)/page.js"
git mv not-found.js "(site)/not-found.js"
git mv error.js "(site)/error.js"
git mv properties "(site)/properties"
git mv property "(site)/property"
```

`sitemap.js`, `robots.js`, `globals.css`, `favicon.ico` and `layout.js` stay put — they are application-root conventions and moving them risks them not being emitted.

- [ ] **Step 2: Create `frontend/src/app/(site)/layout.js`**

```jsx
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/**
 * Layout for the public marketing site.
 *
 * The header and footer live here rather than in the root layout so they do not render
 * inside /admin, which has its own chrome. "(site)" is a route group — the parentheses
 * mean it contributes nothing to the URL, so every public path is unchanged.
 *
 * not-found.js and error.js were moved into this group deliberately: a root-level
 * not-found renders outside every group's layout, which would strip the navigation off
 * the 404 page — exactly the page a visitor who mistyped a listing URL needs it on.
 */
export default function SiteLayout({ children }) {
  return (
    <>
      <Header />
      {/* Grows so the footer sits at the bottom on short pages. */}
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Strip the chrome from `frontend/src/app/layout.js`**

Remove the `Header` and `Footer` imports and their JSX. The body becomes:

```jsx
      <body className="min-h-full flex flex-col">
        {/* Site-level structured data — emitted once, on every page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        {children}
        {/* Single toast portal for the whole app — components call toast() directly. */}
        <Toaster position="bottom-center" />
      </body>
```

Keep the `organizationJsonLd` import, the fonts, and `metadata`. Delete only the two chrome imports.

- [ ] **Step 4: Verify every public URL still works**

Run: `cd frontend && npm run build`
Expected: build succeeds and the route list still shows `/`, `/properties`, `/property/[slug]`, `/robots.txt`, `/sitemap.xml` — with no `(site)` segment in any of them.

Then `npm run dev` and confirm `/` and `/properties` still render the header and footer, and that a bad URL like `/nope` shows the 404 **with** the header and footer.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app
git commit -m "refactor(frontend): move public pages into a (site) route group"
```

---

## Task 2: Proxy guard and 401 redirect

**Files:**
- Create: `frontend/src/proxy.js`
- Modify: `frontend/src/lib/api/client.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a redirect to `/admin/login` for unauthenticated `/admin/*` requests, and a client-side redirect on any 401.

- [ ] **Step 1: Create `frontend/src/proxy.js`**

Next 16 renamed Middleware to Proxy. The file sits beside `app/`, so `src/proxy.js`.

```js
import { NextResponse } from "next/server";

/**
 * Optimistic auth guard for the admin panel.
 *
 * This checks only that the session cookie EXISTS. It cannot verify the token — the
 * signing key belongs to the backend — and it deliberately does not try. Next 16's docs
 * are explicit that Proxy is for optimistic checks, not authorization.
 *
 * Its only job is to avoid rendering empty admin chrome before the session call
 * resolves. A forged or expired cookie sails past it and is rejected by the API, which
 * re-loads the account on every request and is the actual gate.
 */
export function proxy(request) {
  const hasSession = request.cookies.has("re_token");
  const { pathname } = request.nextUrl;

  // The login page must stay reachable without a session, or nobody can ever sign in.
  if (pathname === "/admin/login") {
    // Already signed in? Skip the form and go to the panel.
    if (hasSession) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

// Scoped to the admin panel — the public site must never pay for this check.
export const config = {
  matcher: "/admin/:path*",
};
```

- [ ] **Step 2: Add the 401 redirect to `frontend/src/lib/api/client.js`**

Inside the existing response interceptor's error branch, after `normalised.details` is set and **before** `return Promise.reject(normalised)`:

```js
    // A 401 means the session is gone — expired, signed out elsewhere, or the account
    // was deactivated (requireAuth re-checks it every request). Handled once here so no
    // call site needs its own redirect. Guarded against the login page itself, where a
    // 401 is just a wrong password and must render as a form error.
    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/admin/login")
    ) {
      window.location.href = "/admin/login";
    }
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build && npm run dev`

Visit `http://localhost:3000/admin` in a private window. Expected: redirected to `/admin/login`. The login page will 404 until Task 6 — a 404 at that URL confirms the redirect fired.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/proxy.js frontend/src/lib/api/client.js
git commit -m "feat(frontend): admin proxy guard and 401 redirect"
```

---

## Task 3: useAdminResource hook

**Files:**
- Create: `frontend/src/hooks/useAdminResource.js`
- Test: `frontend/src/hooks/useAdminResource.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `useAdminResource(fetcher, deps) => { data, loading, error, refetch }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useAdminResource.test.js`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAdminResource } from "./useAdminResource";

describe("useAdminResource", () => {
  it("starts loading, then resolves data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ enquiries: [{ _id: "1" }] });

    const { result } = renderHook(() => useAdminResource(fetcher, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ enquiries: [{ _id: "1" }] });
    expect(result.current.error).toBeNull();
  });

  it("surfaces the normalised error and stops loading", async () => {
    const failure = new Error("Session expired");
    const fetcher = vi.fn().mockRejectedValue(failure);

    const { result } = renderHook(() => useAdminResource(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it("refetches when a dependency changes", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const { rerender } = renderHook(({ status }) => useAdminResource(fetcher, [status]), {
      initialProps: { status: "new" },
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    rerender({ status: "contacted" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("refetch() re-runs the fetcher on demand", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAdminResource(fetcher, []));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale response that resolves after a newer one", async () => {
    // Filter changes fire faster than the network answers. Without sequence tracking
    // the FIRST request's late response overwrites the second's, and the table shows
    // results for a filter the user already moved off.
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const fetcher = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ label: "second" });

    const { result, rerender } = renderHook(
      ({ status }) => useAdminResource(fetcher, [status]),
      { initialProps: { status: "new" } },
    );

    rerender({ status: "contacted" });
    await waitFor(() => expect(result.current.data).toEqual({ label: "second" }));

    // The first request answers last — and must be discarded.
    await act(async () => {
      resolveFirst({ label: "first" });
      await first;
    });

    expect(result.current.data).toEqual({ label: "second" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useAdminResource.test.js`
Expected: FAIL — cannot resolve `./useAdminResource`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/hooks/useAdminResource.js`:

```js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Fetch one admin resource, with loading, error and manual refetch.
 *
 * Deliberately small: a data library would be a new dependency for four screens, and
 * the admin panel's needs are a read, a mutation, and a refetch. Mutations do NOT go
 * through this hook — a screen calls the API directly and then calls refetch().
 *
 * @param {() => Promise<object>} fetcher Returns the unwrapped `data` object.
 * @param {Array} deps Re-runs the fetcher when any of these change.
 * @returns {{data: object|null, loading: boolean, error: Error|null, refetch: () => Promise<void>}}
 */
export function useAdminResource(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monotonic request id. Only the newest request may write to state — filter changes
  // fire faster than the network answers, and without this an older response landing
  // late would overwrite a newer one.
  const requestId = useRef(0);

  // The fetcher is usually an inline arrow, so a new identity every render. Holding it
  // in a ref keeps it out of the effect's dependency list, which would otherwise
  // re-fire on every render and loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const result = await fetcherRef.current();
      // A newer request has already started — discard this answer entirely.
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (id !== requestId.current) return;
      // The Axios interceptor already normalised this; pass it through untouched so
      // callers can read `details` for field-level errors.
      setError(caught);
      setData(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: load };
}

export default useAdminResource;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useAdminResource.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks
git commit -m "feat(frontend): useAdminResource hook with stale-response guarding"
```

---

## Task 4: Frontend viewing transition table

**Files:**
- Create: `frontend/src/lib/viewingTransitions.js`
- Test: `frontend/src/lib/viewingTransitions.test.js`

This duplicates `backend/utils/viewingTransitions.js` on purpose. The direction of
authority is one-way: **this copy decides which buttons render; the backend copy decides
what is allowed.** If they drift, the API's 400 wins and the user sees it. Never invert
that by trusting this table server-side.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `VIEWING_TRANSITIONS: Record<string, string[]>`
  - `actionsFor(status: string) => Array<{ status, label, tone }>`
  - `STATUS_LABELS: Record<string, string>`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/viewingTransitions.test.js`:

```js
import { describe, it, expect } from "vitest";
import { VIEWING_TRANSITIONS, actionsFor, STATUS_LABELS } from "./viewingTransitions";

describe("VIEWING_TRANSITIONS", () => {
  // These sets are asserted literally rather than derived, so a drift from the backend
  // table fails loudly here instead of silently rendering a button the API rejects.
  it("matches the backend table exactly", () => {
    expect(VIEWING_TRANSITIONS).toEqual({
      requested: ["accepted", "rejected", "rescheduled", "cancelled"],
      rescheduled: ["accepted", "rejected", "cancelled"],
      accepted: ["completed", "cancelled", "rescheduled"],
      rejected: [],
      completed: [],
      cancelled: [],
    });
  });
});

describe("actionsFor", () => {
  it("offers every legal move from requested", () => {
    const statuses = actionsFor("requested").map((action) => action.status);
    expect(statuses).toEqual(["accepted", "rejected", "rescheduled", "cancelled"]);
  });

  it("offers nothing for a terminal status", () => {
    expect(actionsFor("completed")).toEqual([]);
    expect(actionsFor("rejected")).toEqual([]);
    expect(actionsFor("cancelled")).toEqual([]);
  });

  it("gives every action a human label", () => {
    for (const action of actionsFor("requested")) {
      expect(action.label).toBeTruthy();
      expect(action.label).not.toContain("_");
    }
  });

  it("returns nothing for an unknown status rather than throwing", () => {
    expect(actionsFor("abducted")).toEqual([]);
  });
});

describe("STATUS_LABELS", () => {
  it("labels every status in the table", () => {
    for (const status of Object.keys(VIEWING_TRANSITIONS)) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/viewingTransitions.test.js`
Expected: FAIL — cannot resolve `./viewingTransitions`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/viewingTransitions.js`:

```js
/**
 * Which viewing actions to offer, given the current status.
 *
 * This MIRRORS backend/utils/viewingTransitions.js, deliberately. The authority is
 * one-way: this copy decides which buttons render, the backend decides what is actually
 * allowed. If the two ever drift, the API returns 400 and the user sees that message.
 * Never treat this table as enforcement.
 */

export const VIEWING_TRANSITIONS = {
  requested: ["accepted", "rejected", "rescheduled", "cancelled"],
  rescheduled: ["accepted", "rejected", "cancelled"],
  accepted: ["completed", "cancelled", "rescheduled"],
  // Terminal — reopening one would misrepresent what happened.
  rejected: [],
  completed: [],
  cancelled: [],
};

/** Human labels for a status shown as a badge. */
export const STATUS_LABELS = {
  requested: "Requested",
  accepted: "Accepted",
  rescheduled: "Rescheduled",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Badge tone per status, matching the Badge component's vocabulary. */
export const STATUS_TONES = {
  requested: "accent",
  accepted: "success",
  rescheduled: "warning",
  rejected: "danger",
  completed: "muted",
  cancelled: "muted",
};

// The wording on the button that performs each transition. "Accepted" is a state;
// "Accept" is what the staff member is doing.
const ACTION_LABELS = {
  accepted: "Accept",
  rejected: "Decline",
  rescheduled: "Propose new time",
  cancelled: "Cancel",
  completed: "Mark completed",
};

// Destructive-looking outcomes get a quieter treatment than the primary action.
const ACTION_TONES = {
  accepted: "primary",
  completed: "primary",
  rescheduled: "secondary",
  rejected: "secondary",
  cancelled: "secondary",
};

/**
 * The actions to render for a viewing in the given status.
 *
 * @param {string} status
 * @returns {Array<{status: string, label: string, tone: string}>} empty for a terminal
 *   or unrecognised status.
 */
export function actionsFor(status) {
  return (VIEWING_TRANSITIONS[status] ?? []).map((next) => ({
    status: next,
    label: ACTION_LABELS[next],
    tone: ACTION_TONES[next],
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/viewingTransitions.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/viewingTransitions.js frontend/src/lib/viewingTransitions.test.js
git commit -m "feat(frontend): viewing transition table for action rendering"
```

---

## Task 5: Admin API wrappers and session provider

**Files:**
- Create: `frontend/src/lib/api/admin.js`
- Create: `frontend/src/components/admin/AdminSessionProvider.jsx`
- Test: `frontend/src/components/admin/AdminSessionProvider.test.jsx`

**Interfaces:**
- Consumes: `apiClient` from `@/lib/api/client`.
- Produces (admin.js): `login({email,password})`, `logout()`, `getMe()`, `getEnquiries(params)`, `getEnquiryStats()`, `getEnquiry(id)`, `updateEnquiry(id, body)`, `deleteEnquiry(id)`, `getViewings(params)`, `getViewing(id)`, `updateViewing(id, body)`, `deleteViewing(id)`. Each returns the unwrapped `data` object.
- Produces (provider): `<AdminSessionProvider>` and `useAdminSession() => { user, loading, refresh, signOut }`.

- [ ] **Step 1: Create `frontend/src/lib/api/admin.js`**

```js
"use client";

import apiClient from "@/lib/api/client";

/**
 * Typed wrappers for the admin API.
 *
 * The only place admin URLs are written. Screens import these rather than building a
 * path inline, so a route change is a one-file edit and no component has to know the
 * `{ success, data }` envelope — every wrapper returns the unwrapped `data`.
 */

/** Sign in. Sets the httpOnly cookie; the token never reaches JS. */
export async function login(credentials) {
  const { data } = await apiClient.post("/auth/login", credentials);
  return data.data;
}

/** Sign out. Clears the cookie server-side. */
export async function logout() {
  await apiClient.post("/auth/logout");
}

/** Restore the session on reload. 401 when signed out. */
export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data.data;
}

/** The enquiry inbox. `params` is the filter object; axios serialises arrays. */
export async function getEnquiries(params = {}) {
  const { data } = await apiClient.get("/admin/enquiries", { params });
  return data.data;
}

/** Counts by status, scoped to the caller. */
export async function getEnquiryStats() {
  const { data } = await apiClient.get("/admin/enquiries/stats");
  return data.data;
}

/** One lead, including internal notes. */
export async function getEnquiry(id) {
  const { data } = await apiClient.get(`/admin/enquiries/${id}`);
  return data.data;
}

/** Update status, notes, or (administrators only) the assigned agent. */
export async function updateEnquiry(id, body) {
  const { data } = await apiClient.patch(`/admin/enquiries/${id}`, body);
  return data.data;
}

/** Permanent, administrator-only deletion. Returns 204 with no body. */
export async function deleteEnquiry(id) {
  await apiClient.delete(`/admin/enquiries/${id}`);
}

/** The viewing diary. */
export async function getViewings(params = {}) {
  const { data } = await apiClient.get("/admin/viewings", { params });
  return data.data;
}

/** One viewing, including internal notes. */
export async function getViewing(id) {
  const { data } = await apiClient.get(`/admin/viewings/${id}`);
  return data.data;
}

/** Drive the status machine, and set scheduledFor / responseMessage / notes. */
export async function updateViewing(id, body) {
  const { data } = await apiClient.patch(`/admin/viewings/${id}`, body);
  return data.data;
}

/** Permanent, administrator-only deletion. Returns 204 with no body. */
export async function deleteViewing(id) {
  await apiClient.delete(`/admin/viewings/${id}`);
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/components/admin/AdminSessionProvider.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdminSessionProvider, useAdminSession } from "./AdminSessionProvider";

const getMe = vi.fn();
const logout = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  getMe: (...args) => getMe(...args),
  logout: (...args) => logout(...args),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

/** Renders whatever the session context currently holds. */
function Probe() {
  const { user } = useAdminSession();
  return <p>Signed in as {user.name}</p>;
}

beforeEach(() => {
  getMe.mockReset();
  logout.mockReset();
  replace.mockReset();
});

describe("AdminSessionProvider", () => {
  it("renders children once the session resolves", async () => {
    getMe.mockResolvedValue({ user: { name: "Ada Agent", role: "agent" } });

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    expect(await screen.findByText(/Signed in as Ada Agent/)).toBeInTheDocument();
  });

  it("does not render children while the session is loading", () => {
    // Never resolves — the provider must not flash an unauthenticated shell.
    getMe.mockReturnValue(new Promise(() => {}));

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("redirects to login when the session call fails", async () => {
    const failure = new Error("Authentication required");
    failure.status = 401;
    getMe.mockRejectedValue(failure);

    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/AdminSessionProvider.test.jsx`
Expected: FAIL — cannot resolve `./AdminSessionProvider`.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/components/admin/AdminSessionProvider.jsx`:

```jsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout as apiLogout } from "@/lib/api/admin";

/**
 * Holds the signed-in staff account for the whole admin panel.
 *
 * This is layer 2 of three. The proxy guard before it is optimistic (cookie presence
 * only); the API after it is the real gate, re-loading the account on every request so
 * a deactivated staff member loses access on their next action rather than in seven
 * days. This layer exists so screens can read `user.role` without each one fetching.
 */
const AdminSessionContext = createContext(null);

/**
 * Read the current session.
 *
 * Safe to call `user.role` directly: the provider renders no children until the session
 * has resolved, so `user` is never null inside it.
 */
export function useAdminSession() {
  const context = useContext(AdminSessionContext);

  // A clearer failure than "cannot read property of null" three components deep.
  if (!context) {
    throw new Error("useAdminSession must be used inside <AdminSessionProvider>");
  }

  return context;
}

export function AdminSessionProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Load (or reload) the session. */
  const refresh = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
    } catch {
      // Any failure here means no usable session — expired, signed out elsewhere, or
      // the account was deactivated. The specific reason isn't actionable for the user.
      setUser(null);
      router.replace("/admin/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Sign out, then leave the panel. */
  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Clear local state even if the request failed — the user asked to leave, and a
      // stale "signed in" panel after clicking sign out is worse than a failed call.
      setUser(null);
      router.replace("/admin/login");
    }
  }, [router]);

  // Render nothing until the session resolves. Without this every screen would flash
  // through a no-permissions state before the user arrives, and role-gated controls
  // would appear and then vanish.
  if (loading || !user) return null;

  return (
    <AdminSessionContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export default AdminSessionProvider;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/admin/AdminSessionProvider.test.jsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api/admin.js frontend/src/components/admin
git commit -m "feat(frontend): admin API wrappers and session provider"
```

---

## Task 6: Login page

**Files:**
- Create: `frontend/src/app/admin/login/page.js`

Sits **outside** `(panel)`, so it renders without a session — otherwise nobody could sign in.

**Interfaces:**
- Consumes: `login` from `@/lib/api/admin`; `Button`, `Container` from `@/components/ui`.
- Produces: the `/admin/login` route.

- [ ] **Step 1: Create the page**

```jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import { login } from "@/lib/api/admin";
import siteConfig from "@/config/site";

/**
 * Staff sign-in.
 *
 * Lives outside the (panel) group because it must render without a session. The proxy
 * guard sends an already-signed-in visitor straight to /admin.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  // Not a field-level error, so it lives outside react-hook-form's error state.
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: "", password: "" } });

  const onSubmit = async (values) => {
    setFormError(null);

    try {
      await login(values);
      // replace, not push: the login page must not sit in the back history of a
      // signed-in session.
      router.replace("/admin");
    } catch (error) {
      // The API returns ONE generic error for both a wrong password and an unknown
      // account, so the endpoint cannot be used to enumerate accounts. Do not "improve"
      // this by wording the two differently — that would undo the protection.
      // 429 is the login throttle (10 failures / 15 min) and is genuinely different
      // information, so it gets its own message.
      setFormError(
        error.status === 429
          ? "Too many failed attempts. Please wait 15 minutes and try again."
          : "Those details don't match an account.",
      );
    }
  };

  return (
    <Container className="flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm">
        {/* Wordmark from config — no brand string is written into this component. */}
        <p className="font-display text-2xl text-ink">{siteConfig.name}</p>
        <h1 className="mt-2 text-xl text-ink-soft">Staff sign in</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              {...register("email", { required: "Email is required" })}
              aria-invalid={Boolean(errors.email)}
              className="min-h-11 w-full rounded border border-border bg-surface-raised px-3 text-ink"
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-ink-soft">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password", { required: "Password is required" })}
              aria-invalid={Boolean(errors.password)}
              className="min-h-11 w-full rounded border border-border bg-surface-raised px-3 text-ink"
            />
            <FieldError message={errors.password?.message} />
          </div>

          {/* Whole-form failure, announced to screen readers. */}
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </Container>
  );
}
```

- [ ] **Step 2: Verify against the running backend**

Run both servers, visit `http://localhost:3000/admin/login`, and sign in with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env`.

Expected: a wrong password shows "Those details don't match an account."; correct
credentials redirect to `/admin` (which 404s until Task 7 — that confirms login worked).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/login
git commit -m "feat(frontend): staff login page"
```

---

## Task 7: Admin shell and dashboard

**Files:**
- Create: `frontend/src/components/admin/AdminSidebar.jsx`
- Create: `frontend/src/app/admin/(panel)/layout.js`
- Create: `frontend/src/app/admin/(panel)/page.js`

**Interfaces:**
- Consumes: `useAdminSession` (Task 5); `useAdminResource` (Task 3); `getEnquiryStats`, `getViewings` (Task 5).
- Produces: the authenticated shell and the `/admin` dashboard.

- [ ] **Step 1: Create `frontend/src/components/admin/AdminSidebar.jsx`**

```jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiGrid, FiInbox, FiCalendar, FiHome, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import siteConfig from "@/config/site";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";

/**
 * Admin navigation.
 *
 * Listings is present but disabled — that module is a separate slice, and a visible
 * disabled entry tells staff it is coming rather than implying the panel is complete.
 */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: FiGrid },
  { href: "/admin/enquiries", label: "Enquiries", icon: FiInbox },
  { href: "/admin/viewings", label: "Viewings", icon: FiCalendar },
  { href: "/admin/properties", label: "Listings", icon: FiHome, disabled: true },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAdminSession();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        // Exact match for the dashboard; prefix match for its children, so
        // /admin/enquiries?id=x still highlights Enquiries.
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded px-3 text-sm text-muted"
              title="Coming soon"
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 text-sm transition-colors duration-200 ${
              active
                ? "bg-accent/10 text-accent-text"
                : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="border-t border-border pt-4">
      <p className="text-sm text-ink">{user.name}</p>
      {/* Role is shown because it explains why some controls are absent. */}
      <p className="text-xs uppercase tracking-[0.08em] text-muted">{user.role}</p>
      <button
        type="button"
        onClick={signOut}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
      >
        <FiLogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <span className="font-display text-lg text-ink">{siteConfig.name}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
        >
          <FiMenu size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-surface p-4 lg:hidden"
          style={{ zIndex: "var(--z-dropdown)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
        >
          <div className="mb-8 flex items-center justify-between">
            <span className="font-display text-lg text-ink">{siteConfig.name}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
            >
              <FiX size={22} aria-hidden="true" />
            </button>
          </div>
          {nav}
          <div className="mt-8">{identity}</div>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border p-4 lg:flex">
        <div>
          <Link href="/admin" className="font-display text-lg text-ink">
            {siteConfig.name}
          </Link>
          <p className="mb-8 text-xs uppercase tracking-[0.08em] text-muted">Admin</p>
          {nav}
        </div>
        {identity}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/admin/(panel)/layout.js`**

```jsx
"use client";

import AdminSessionProvider from "@/components/admin/AdminSessionProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";

/**
 * Shell for every authenticated admin screen.
 *
 * "(panel)" is a route group, so it adds nothing to the URL — /admin/(panel)/page.js
 * serves /admin. The login page sits outside it precisely because it must render
 * without a session.
 *
 * The provider renders nothing until the session resolves, so the sidebar can read
 * user.role unconditionally.
 */
export default function AdminPanelLayout({ children }) {
  return (
    <AdminSessionProvider>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AdminSidebar />
        {/* min-w-0 lets wide tables scroll inside this column instead of stretching it. */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AdminSessionProvider>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/admin/(panel)/page.js`**

```jsx
"use client";

import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getEnquiryStats, getViewings } from "@/lib/api/admin";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import Badge from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/viewingTransitions";

/**
 * Admin dashboard — where a staff member orients on arrival.
 *
 * Both reads are already scoped to the caller by the API, so an agent sees their own
 * numbers with no filtering here.
 */

// Order matters: it is the pipeline, left to right.
const STAT_ORDER = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "viewing_booked", label: "Viewing booked" },
  { key: "closed", label: "Closed" },
];

export default function AdminDashboardPage() {
  const { user } = useAdminSession();

  const stats = useAdminResource(() => getEnquiryStats(), []);
  const viewings = useAdminResource(
    () => getViewings({ upcoming: true, limit: 5 }),
    [],
  );

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl text-ink">Welcome back, {user.name.split(" ")[0]}</h1>

      {/* Enquiry pipeline. Each tile links into the inbox pre-filtered. */}
      <section className="mt-8">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Enquiries
        </h2>

        {stats.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_ORDER.map((stat) => (
              <Skeleton key={stat.key} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_ORDER.map((stat) => (
              <Link
                key={stat.key}
                href={`/admin/enquiries?status=${stat.key}`}
                className="group rounded-lg border border-border bg-surface-raised p-5 transition-colors duration-200 hover:border-accent"
              >
                <p className="text-xs uppercase tracking-[0.08em] text-muted">
                  {stat.label}
                </p>
                {/* Tabular figures so the row of numbers aligns. */}
                <p className="tabular mt-2 font-display text-3xl text-ink">
                  {stats.data?.stats?.[stat.key] ?? 0}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Next few viewings — the other thing a staff member checks on arrival. */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
            Upcoming viewings
          </h2>
          <Link
            href="/admin/viewings"
            className="flex items-center gap-1.5 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
          >
            View all
            <FiArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {viewings.loading ? (
          <Skeleton className="h-40" />
        ) : viewings.data?.viewings?.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
            {viewings.data.viewings.map((viewing) => (
              <li key={viewing._id}>
                <Link
                  href={`/admin/viewings?id=${viewing._id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors duration-200 hover:bg-ink/5"
                >
                  <div>
                    <p className="text-ink">{viewing.name}</p>
                    <p className="text-sm text-muted">
                      {viewing.property?.title ?? "Property removed"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="tabular text-sm text-ink-soft">
                      {new Date(viewing.requestedFor).toLocaleString("en-NG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge tone={STATUS_TONES[viewing.status]}>
                      {STATUS_LABELS[viewing.status]}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border bg-surface-raised px-5 py-8 text-center text-sm text-muted">
            No viewings scheduled.
          </p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Sign in and land on `/admin`. Expected: four stat tiles with real counts from
`realestate_dev`, an upcoming-viewings list (likely empty on seeded data — the empty
state must render, not a blank area), a sidebar with Listings greyed out, and a working
sign-out that returns to the login page.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/AdminSidebar.jsx "frontend/src/app/admin/(panel)"
git commit -m "feat(frontend): admin shell and dashboard"
```

---

## Task 8: Shared admin components

**Files:**
- Create: `frontend/src/components/admin/MasterDetail.jsx`
- Create: `frontend/src/components/admin/ConfirmDialog.jsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/Button`.
- Produces:
  - `<MasterDetail list detail hasSelection onClearSelection />`
  - `<ConfirmDialog open title body confirmLabel onConfirm onCancel loading />`

- [ ] **Step 1: Create `frontend/src/components/admin/MasterDetail.jsx`**

```jsx
"use client";

import { FiArrowLeft } from "react-icons/fi";

/**
 * The two-column shell shared by the inbox and the diary.
 *
 * Desktop shows both columns; below lg only one is visible at a time, because a
 * side-by-side master-detail on a phone gives neither half enough room. Which one
 * shows is driven by `hasSelection`, which the parent derives from the URL — so the
 * layout has no state of its own.
 *
 * @param {ReactNode} list Left column.
 * @param {ReactNode} detail Right column; rendered only when hasSelection.
 * @param {boolean} hasSelection Whether a row is currently selected.
 * @param {() => void} onClearSelection Back action for the mobile detail view.
 */
export default function MasterDetail({ list, detail, hasSelection, onClearSelection }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* List column — hidden on mobile while a row is selected. */}
      <div
        className={`w-full overflow-y-auto border-r border-border lg:block lg:w-96 lg:shrink-0 ${
          hasSelection ? "hidden" : "block"
        }`}
      >
        {list}
      </div>

      {/* Detail column */}
      <div
        className={`w-full overflow-y-auto lg:block ${hasSelection ? "block" : "hidden"}`}
      >
        {hasSelection ? (
          <>
            {/* Mobile-only escape back to the list. */}
            <button
              type="button"
              onClick={onClearSelection}
              className="flex min-h-11 cursor-pointer items-center gap-2 px-5 pt-4 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text lg:hidden"
            >
              <FiArrowLeft size={16} aria-hidden="true" />
              Back to list
            </button>
            {detail}
          </>
        ) : (
          // Desktop resting state. Without this the right half looks broken on load.
          <div className="hidden h-full items-center justify-center p-10 lg:flex">
            <p className="text-sm text-muted">Select a row to see its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/admin/ConfirmDialog.jsx`**

```jsx
"use client";

import Button from "@/components/ui/Button";

/**
 * Confirmation for an irreversible action.
 *
 * Used only for deletion, which on leads is a HARD delete for NDPA erasure — there is
 * no restore, unlike the soft delete on listings. The body text must say so plainly.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete permanently",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-ink/60 p-4"
      style={{ zIndex: "var(--z-lightbox)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md rounded-lg bg-surface-raised p-6">
        <h2 id="confirm-title" className="text-xl text-ink">
          {title}
        </h2>
        <p className="mt-3 text-sm text-ink-soft">{body}</p>

        <div className="mt-8 flex justify-end gap-3">
          {/* Cancel first in the DOM so a keyboard user reaches the safe option first. */}
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Lint and commit**

Run: `cd frontend && npm run lint`
Expected: silent.

```bash
git add frontend/src/components/admin/MasterDetail.jsx frontend/src/components/admin/ConfirmDialog.jsx
git commit -m "feat(frontend): shared master-detail and confirm dialog"
```

---

## Task 9: Enquiry inbox

**Files:**
- Create: `frontend/src/components/admin/EnquiryList.jsx`
- Create: `frontend/src/components/admin/EnquiryDetail.jsx`
- Create: `frontend/src/app/admin/(panel)/enquiries/page.js`
- Test: `frontend/src/components/admin/EnquiryDetail.test.jsx`

**Interfaces:**
- Consumes: `MasterDetail`, `ConfirmDialog` (Task 8); `useAdminResource` (Task 3); `getEnquiries`, `getEnquiry`, `updateEnquiry`, `deleteEnquiry` (Task 5); `useAdminSession` (Task 5).
- Produces: `<EnquiryList enquiries selectedId onSelect />`, `<EnquiryDetail id onChanged onDeleted />`, and the `/admin/enquiries` route.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/EnquiryDetail.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EnquiryDetail from "./EnquiryDetail";

const getEnquiry = vi.fn();
const updateEnquiry = vi.fn();
const deleteEnquiry = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  getEnquiry: (...args) => getEnquiry(...args),
  updateEnquiry: (...args) => updateEnquiry(...args),
  deleteEnquiry: (...args) => deleteEnquiry(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The session role decides which controls render.
let role = "agent";
vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: { name: "Ada", role } }),
}));

const enquiry = {
  _id: "e1",
  name: "Chidi Nwosu",
  phone: "+2348012345678",
  email: "chidi@example.com",
  message: "Is this still available?",
  status: "new",
  type: "property_enquiry",
  source: "property_page",
  notes: "",
  createdAt: "2026-09-01T10:00:00.000Z",
  property: { title: "3 Bed Flat, Lekki", slug: "3-bed-flat-lekki-ref1", reference: "REF1" },
  agent: { name: "Ada Agent" },
};

beforeEach(() => {
  role = "agent";
  getEnquiry.mockReset().mockResolvedValue({ enquiry });
  updateEnquiry.mockReset().mockResolvedValue({ enquiry });
  deleteEnquiry.mockReset().mockResolvedValue(undefined);
});

describe("EnquiryDetail", () => {
  it("renders the lead's contact details and message", async () => {
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    expect(await screen.findByText("Chidi Nwosu")).toBeInTheDocument();
    expect(screen.getByText("+2348012345678")).toBeInTheDocument();
    expect(screen.getByText(/Is this still available/)).toBeInTheDocument();
  });

  it("hides the delete control from an agent", async () => {
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    // The API returns 403 regardless — hiding it is courtesy, not security.
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("shows the delete control to an administrator", async () => {
    role = "administrator";
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("saves a status change and tells the parent to refresh", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<EnquiryDetail id="e1" onChanged={onChanged} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.selectOptions(screen.getByLabelText(/status/i), "contacted");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateEnquiry).toHaveBeenCalledTimes(1));
    expect(updateEnquiry).toHaveBeenCalledWith("e1", {
      status: "contacted",
      notes: "",
    });
    // The list shows status too, so it has to re-read after a change.
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("surfaces a field-level API error next to the field", async () => {
    const user = userEvent.setup();
    const failure = new Error("Validation failed");
    failure.details = { status: "That status is not allowed here" };
    updateEnquiry.mockRejectedValue(failure);

    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText(/That status is not allowed here/),
    ).toBeInTheDocument();
  });

  it("warns that deletion is permanent before deleting", async () => {
    const user = userEvent.setup();
    role = "administrator";
    render(<EnquiryDetail id="e1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /delete/i }));

    // NDPA erasure has no undo — the dialog must say so.
    expect(await screen.findByText(/permanent|cannot be undone/i)).toBeInTheDocument();
    expect(deleteEnquiry).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/EnquiryDetail.test.jsx`
Expected: FAIL — cannot resolve `./EnquiryDetail`.

- [ ] **Step 3: Create `frontend/src/components/admin/EnquiryList.jsx`**

```jsx
"use client";

import Badge from "@/components/ui/Badge";
import { humanise } from "@/lib/format";

/**
 * Left column of the inbox: one row per lead.
 *
 * Presentational only — it never fetches and holds no state. Selection is owned by the
 * page, which keeps it in the URL.
 */

// Status key -> badge tone. Every badge also carries its label, so status is never
// communicated by colour alone.
const STATUS_TONES = {
  new: "accent",
  contacted: "warning",
  viewing_booked: "success",
  closed: "muted",
};

/** "2 hours ago" — precise timestamps are noise in a list scanned for freshness. */
function relativeTime(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function EnquiryList({ enquiries = [], selectedId, onSelect }) {
  if (enquiries.length === 0) {
    return <p className="p-6 text-sm text-muted">No enquiries match these filters.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {enquiries.map((enquiry) => {
        const selected = enquiry._id === selectedId;

        return (
          <li key={enquiry._id}>
            <button
              type="button"
              onClick={() => onSelect(enquiry._id)}
              aria-current={selected ? "true" : undefined}
              className={`w-full cursor-pointer px-5 py-4 text-left transition-colors duration-200 ${
                selected ? "bg-accent/10" : "hover:bg-ink/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-ink">{enquiry.name}</p>
                <Badge tone={STATUS_TONES[enquiry.status] ?? "muted"}>
                  {humanise(enquiry.status)}
                </Badge>
              </div>

              <p className="mt-1 truncate text-sm text-ink-soft">
                {/* A general enquiry has no property — say so rather than showing blank. */}
                {enquiry.property?.title ?? "General enquiry"}
              </p>
              <p className="mt-1 text-xs text-muted">{relativeTime(enquiry.createdAt)}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/admin/EnquiryDetail.jsx`**

```jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiPhone, FiMessageCircle, FiMail } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import FieldError from "@/components/forms/FieldError";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { getEnquiry, updateEnquiry, deleteEnquiry } from "@/lib/api/admin";
import { humanise } from "@/lib/format";

/**
 * Right column of the inbox: the full lead, plus the controls that act on it.
 *
 * @param {string} id The selected enquiry.
 * @param {() => void} onChanged Called after a save, so the list re-reads — it shows
 *   status too and would otherwise go stale.
 * @param {() => void} onDeleted Called after a deletion, so the page clears selection.
 */
export default function EnquiryDetail({ id, onChanged, onDeleted }) {
  const { user } = useAdminSession();
  const { data, loading, error } = useAdminResource(() => getEnquiry(id), [id]);

  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const enquiry = data?.enquiry;

  // Seed the form whenever a different lead loads. Without this, switching rows would
  // leave the previous lead's status sitting in the select.
  useEffect(() => {
    if (!enquiry) return;
    setStatus(enquiry.status);
    setNotes(enquiry.notes ?? "");
    setFieldErrors(null);
  }, [enquiry]);

  const onSave = async () => {
    setSaving(true);
    setFieldErrors(null);

    try {
      await updateEnquiry(id, { status, notes });
      toast.success("Lead updated.");
      onChanged();
    } catch (caught) {
      // `details` is the API's field-level map; anything else is a general failure.
      if (caught.details) setFieldErrors(caught.details);
      else toast.error(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);

    try {
      await deleteEnquiry(id);
      toast.success("Lead deleted.");
      setConfirmOpen(false);
      onDeleted();
    } catch (caught) {
      toast.error(caught.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error || !enquiry) {
    return <p className="p-6 text-sm text-danger">{error?.message ?? "Lead not found."}</p>;
  }

  // WhatsApp click-to-chat, pre-filled so the prospect isn't asked to re-explain.
  const whatsapp = enquiry.phone.replace(/\D/g, "");
  const message = encodeURIComponent(
    `Hello ${enquiry.name}, regarding your enquiry${
      enquiry.property ? ` about ${enquiry.property.title}` : ""
    }.`,
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-ink">{enquiry.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {humanise(enquiry.type)} · via {humanise(enquiry.source)}
          </p>
        </div>
        <Badge tone="muted">{humanise(enquiry.status)}</Badge>
      </div>

      {/* Contact actions — phone first, the primary channel in this market. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`tel:${enquiry.phone}`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-ink px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          <FiPhone size={16} aria-hidden="true" />
          {enquiry.phone}
        </a>
        <a
          href={`https://wa.me/${whatsapp}?text=${message}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-border px-5 text-sm text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
        >
          <FiMessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
        {/* Email is optional on this model — only offer it when there is one. */}
        {enquiry.email && (
          <a
            href={`mailto:${enquiry.email}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-border px-5 text-sm text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            <FiMail size={16} aria-hidden="true" />
            {enquiry.email}
          </a>
        )}
      </div>

      {/* Which listing, if any */}
      {enquiry.property && (
        <div className="mt-8 rounded-lg border border-border bg-surface-raised p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Property</p>
          <Link
            href={`/property/${enquiry.property.slug}`}
            target="_blank"
            className="mt-1 block text-ink transition-colors duration-200 hover:text-accent-text"
          >
            {enquiry.property.title} ({enquiry.property.reference})
          </Link>
        </div>
      )}

      {/* What they wrote */}
      {enquiry.message && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Message</p>
          <p className="mt-2 max-w-[68ch] whitespace-pre-line text-ink-soft">
            {enquiry.message}
          </p>
        </div>
      )}

      {/* Pipeline controls */}
      <div className="mt-10 space-y-4 border-t border-border pt-8">
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm text-ink-soft">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 w-full max-w-xs cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
          >
            {["new", "contacted", "viewing_booked", "closed"].map((value) => (
              <option key={value} value={value}>
                {humanise(value)}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.status} />
        </div>

        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm text-ink-soft">
            Internal notes
          </label>
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full max-w-2xl rounded border border-border bg-surface-raised p-3 text-ink"
          />
          <FieldError message={fieldErrors?.notes} />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={onSave} loading={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>

          {/* Administrator-only. The API enforces this regardless of what renders. */}
          {user.role === "administrator" && (
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this lead?"
        body="This permanently erases the prospect's name, phone number and email. It cannot be undone, and there is no restore."
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/admin/EnquiryDetail.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Create `frontend/src/app/admin/(panel)/enquiries/page.js`**

```jsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getEnquiries } from "@/lib/api/admin";
import MasterDetail from "@/components/admin/MasterDetail";
import EnquiryList from "@/components/admin/EnquiryList";
import EnquiryDetail from "@/components/admin/EnquiryDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { humanise } from "@/lib/format";

/**
 * The enquiry inbox.
 *
 * Selection and filters live in the URL, the same discipline the public search uses:
 * a lead stays linkable, and the back button behaves.
 */

const STATUS_TABS = ["", "new", "contacted", "viewing_booked", "closed"];

export default function AdminEnquiriesPage() {
  const router = useRouter();
  const params = useSearchParams();

  const selectedId = params.get("id");
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";

  // Re-runs whenever a filter changes; the hook discards stale responses, so fast tab
  // clicking can't render an older result set over a newer one.
  const { data, loading, refetch } = useAdminResource(
    () => getEnquiries({ status: status || undefined, q: q || undefined, limit: 50 }),
    [status, q],
  );

  /** Build the next URL, preserving whatever we aren't changing. */
  const navigate = (changes) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    router.push(`/admin/enquiries?${next.toString()}`);
  };

  const list = (
    <div>
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border p-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab || "all"}
            type="button"
            // Changing a filter clears the selection: the selected lead may not be in
            // the new result set, which would leave the detail pane orphaned.
            onClick={() => navigate({ status: tab, id: null })}
            className={`min-h-9 cursor-pointer rounded px-3 text-sm transition-colors duration-200 ${
              status === tab
                ? "bg-accent/10 text-accent-text"
                : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {tab ? humanise(tab) : "All"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="border-b border-border p-3">
        <label htmlFor="lead-search" className="sr-only">
          Search leads
        </label>
        <input
          id="lead-search"
          type="search"
          defaultValue={q}
          placeholder="Name, phone or email"
          // Search on Enter rather than per keystroke — this is a network round trip,
          // and the backend rate-limits.
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate({ q: event.target.value, id: null });
          }}
          className="min-h-11 w-full rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        />
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <EnquiryList
          enquiries={data?.enquiries ?? []}
          selectedId={selectedId}
          onSelect={(id) => navigate({ id })}
        />
      )}
    </div>
  );

  return (
    <MasterDetail
      hasSelection={Boolean(selectedId)}
      onClearSelection={() => navigate({ id: null })}
      list={list}
      detail={
        selectedId ? (
          <EnquiryDetail
            // Keying by id forces a fresh mount per lead, so the form state cannot
            // carry over from the previously selected row.
            key={selectedId}
            id={selectedId}
            onChanged={refetch}
            onDeleted={() => {
              navigate({ id: null });
              refetch();
            }}
          />
        ) : null
      }
    />
  );
}
```

- [ ] **Step 7: Verify against real data**

Sign in, open `/admin/enquiries`. The seeded database has no enquiries, so first submit
one through the public site: open a listing, fill the enquiry form, submit.

Expected: the lead appears in the inbox; selecting it shows the detail with the URL
gaining `?id=`; changing status to Contacted and saving shows a toast and updates the
badge in the list; the status tabs filter; signing in as an agent (not the seeded admin)
hides the Delete button.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin "frontend/src/app/admin/(panel)/enquiries"
git commit -m "feat(frontend): enquiry inbox"
```

---

## Task 10: Viewing diary

**Files:**
- Create: `frontend/src/components/admin/ViewingList.jsx`
- Create: `frontend/src/components/admin/ViewingDetail.jsx`
- Create: `frontend/src/app/admin/(panel)/viewings/page.js`
- Test: `frontend/src/components/admin/ViewingDetail.test.jsx`

**Interfaces:**
- Consumes: `MasterDetail`, `ConfirmDialog` (Task 8); `useAdminResource` (Task 3); `actionsFor`, `STATUS_LABELS`, `STATUS_TONES` (Task 4); `getViewings`, `getViewing`, `updateViewing`, `deleteViewing` (Task 5).
- Produces: `<ViewingList viewings selectedId onSelect />`, `<ViewingDetail id onChanged onDeleted />`, and the `/admin/viewings` route.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/ViewingDetail.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ViewingDetail from "./ViewingDetail";

const getViewing = vi.fn();
const updateViewing = vi.fn();
const deleteViewing = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  getViewing: (...args) => getViewing(...args),
  updateViewing: (...args) => updateViewing(...args),
  deleteViewing: (...args) => deleteViewing(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/admin/AdminSessionProvider", () => ({
  useAdminSession: () => ({ user: { name: "Ada", role: "administrator" } }),
}));

/** A date safely in the future, formatted for a datetime-local input. */
function futureLocal(days) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 16);
}

const base = {
  _id: "v1",
  name: "Chidi Nwosu",
  phone: "+2348012345678",
  email: "chidi@example.com",
  status: "requested",
  requestedFor: new Date(Date.now() + 3 * 86400000).toISOString(),
  scheduledFor: null,
  responseMessage: "",
  notes: "",
  property: { title: "3 Bed Flat, Lekki", slug: "3-bed-flat-lekki-ref1", reference: "REF1" },
};

beforeEach(() => {
  getViewing.mockReset().mockResolvedValue({ viewing: base });
  updateViewing.mockReset().mockResolvedValue({ viewing: base });
  deleteViewing.mockReset().mockResolvedValue(undefined);
});

describe("ViewingDetail", () => {
  it("offers every legal action for a requested viewing", async () => {
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /propose new time/i })).toBeInTheDocument();
  });

  it("offers no actions for a terminal status", async () => {
    getViewing.mockResolvedValue({ viewing: { ...base, status: "completed" } });
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    // Reopening a completed viewing would misrepresent what happened.
    expect(screen.getByText(/no further action/i)).toBeInTheDocument();
  });

  it("accepts without a date, letting the API inherit requestedFor", async () => {
    const user = userEvent.setup();
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => expect(updateViewing).toHaveBeenCalledTimes(1));
    const [, body] = updateViewing.mock.calls[0];
    expect(body.status).toBe("accepted");
    // Omitted on purpose — the backend defaults it to requestedFor.
    expect(body.scheduledFor).toBeUndefined();
  });

  it("requires a future date to reschedule", async () => {
    const user = userEvent.setup();
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /propose new time/i }));

    // Submitting the reschedule form with no date must not reach the API.
    await user.click(screen.getByRole("button", { name: /^confirm new time$/i }));
    expect(updateViewing).not.toHaveBeenCalled();
    expect(await screen.findByText(/date is required/i)).toBeInTheDocument();
  });

  it("sends a reschedule with the chosen future time", async () => {
    const user = userEvent.setup();
    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /propose new time/i }));

    const when = futureLocal(9);
    await user.type(screen.getByLabelText(/new date and time/i), when);
    await user.click(screen.getByRole("button", { name: /^confirm new time$/i }));

    await waitFor(() => expect(updateViewing).toHaveBeenCalledTimes(1));
    expect(updateViewing.mock.calls[0][1].status).toBe("rescheduled");
    expect(updateViewing.mock.calls[0][1].scheduledFor).toBeTruthy();
  });

  it("surfaces the API's message when it rejects a transition", async () => {
    const user = userEvent.setup();
    const failure = new Error("A completed viewing cannot be moved to requested.");
    updateViewing.mockRejectedValue(failure);

    render(<ViewingDetail id="v1" onChanged={vi.fn()} onDeleted={vi.fn()} />);

    await screen.findByText("Chidi Nwosu");
    await user.click(screen.getByRole("button", { name: /accept/i }));

    // The backend table is the authority; its wording is shown verbatim.
    await waitFor(() => expect(updateViewing).toHaveBeenCalled());
    expect(
      await screen.findByText(/cannot be moved to requested/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/ViewingDetail.test.jsx`
Expected: FAIL — cannot resolve `./ViewingDetail`.

- [ ] **Step 3: Create `frontend/src/components/admin/ViewingList.jsx`**

```jsx
"use client";

import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/viewingTransitions";

/**
 * Left column of the diary: one row per viewing, soonest first.
 *
 * Presentational only. Unlike the inbox this leads with the date, because a diary is
 * scanned by when, not by who.
 */
export default function ViewingList({ viewings = [], selectedId, onSelect }) {
  if (viewings.length === 0) {
    return <p className="p-6 text-sm text-muted">No viewings match these filters.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {viewings.map((viewing) => {
        const selected = viewing._id === selectedId;
        // The agreed time once there is one, otherwise what the prospect asked for.
        const when = viewing.scheduledFor ?? viewing.requestedFor;

        return (
          <li key={viewing._id}>
            <button
              type="button"
              onClick={() => onSelect(viewing._id)}
              aria-current={selected ? "true" : undefined}
              className={`w-full cursor-pointer px-5 py-4 text-left transition-colors duration-200 ${
                selected ? "bg-accent/10" : "hover:bg-ink/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="tabular text-sm text-ink">
                  {new Date(when).toLocaleString("en-NG", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <Badge tone={STATUS_TONES[viewing.status] ?? "muted"}>
                  {STATUS_LABELS[viewing.status] ?? viewing.status}
                </Badge>
              </div>

              <p className="mt-1 text-ink">{viewing.name}</p>
              <p className="mt-1 truncate text-sm text-muted">
                {viewing.property?.title ?? "Property removed"}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/admin/ViewingDetail.jsx`**

```jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiPhone, FiMessageCircle } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { getViewing, updateViewing, deleteViewing } from "@/lib/api/admin";
import { actionsFor, STATUS_LABELS, STATUS_TONES } from "@/lib/viewingTransitions";

/**
 * Right column of the diary: one viewing and the transitions available from its
 * current status.
 *
 * Which buttons render comes from the frontend transition table; what is actually
 * ALLOWED comes from the backend. When they disagree the API's 400 is shown verbatim —
 * see the note in lib/viewingTransitions.js.
 *
 * @param {string} id The selected viewing.
 * @param {() => void} onChanged Called after a change, so the list re-reads.
 * @param {() => void} onDeleted Called after a deletion, so the page clears selection.
 */
export default function ViewingDetail({ id, onChanged, onDeleted }) {
  const { user } = useAdminSession();
  const { data, loading, error } = useAdminResource(() => getViewing(id), [id]);

  const [responseMessage, setResponseMessage] = useState("");
  const [notes, setNotes] = useState("");
  // Which action is mid-flight, so only that button shows a spinner.
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState(null);
  // The reschedule form is revealed rather than always shown — it only applies to one
  // of the available actions.
  const [rescheduling, setRescheduling] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const viewing = data?.viewing;

  // Seed the form whenever a different viewing loads.
  useEffect(() => {
    if (!viewing) return;
    setResponseMessage(viewing.responseMessage ?? "");
    setNotes(viewing.notes ?? "");
    setActionError(null);
    setRescheduling(false);
    setNewTime("");
  }, [viewing]);

  /**
   * Apply one transition.
   *
   * `scheduledFor` is sent only for a reschedule — on accept it is deliberately
   * omitted so the API inherits `requestedFor`, which is the common case.
   */
  const applyStatus = async (status, scheduledFor) => {
    setPending(status);
    setActionError(null);

    try {
      await updateViewing(id, {
        status,
        ...(scheduledFor ? { scheduledFor } : {}),
        responseMessage,
        notes,
      });
      toast.success("Viewing updated.");
      setRescheduling(false);
      onChanged();
    } catch (caught) {
      // The backend transition table is the authority — show its wording as-is.
      setActionError(caught.message);
    } finally {
      setPending(null);
    }
  };

  /** Submit the reschedule form. */
  const onReschedule = () => {
    if (!newTime) {
      setActionError("A new date is required to propose a different time.");
      return;
    }

    if (new Date(newTime).getTime() <= Date.now()) {
      // Checked here for a fast error; the API checks it again and is the authority.
      setActionError("The new time must be in the future.");
      return;
    }

    applyStatus("rescheduled", new Date(newTime).toISOString());
  };

  const onDelete = async () => {
    setDeleting(true);

    try {
      await deleteViewing(id);
      toast.success("Viewing deleted.");
      setConfirmOpen(false);
      onDeleted();
    } catch (caught) {
      toast.error(caught.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error || !viewing) {
    return (
      <p className="p-6 text-sm text-danger">{error?.message ?? "Viewing not found."}</p>
    );
  }

  const actions = actionsFor(viewing.status);
  const whatsapp = viewing.phone.replace(/\D/g, "");

  return (
    <div className="p-6 lg:p-8">
      {/* Identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-ink">{viewing.name}</h2>
          <p className="mt-1 text-sm text-muted">{viewing.phone}</p>
        </div>
        <Badge tone={STATUS_TONES[viewing.status] ?? "muted"}>
          {STATUS_LABELS[viewing.status] ?? viewing.status}
        </Badge>
      </div>

      {/* Requested vs agreed. Both are shown so staff can see how far it moved. */}
      <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <div className="bg-surface-raised px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">Requested for</dt>
          <dd className="tabular mt-1 text-ink">
            {new Date(viewing.requestedFor).toLocaleString("en-NG")}
          </dd>
        </div>
        <div className="bg-surface-raised px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">Scheduled for</dt>
          <dd className="tabular mt-1 text-ink">
            {viewing.scheduledFor
              ? new Date(viewing.scheduledFor).toLocaleString("en-NG")
              : "Not yet confirmed"}
          </dd>
        </div>
      </dl>

      {/* Contact actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`tel:${viewing.phone}`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-ink px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          <FiPhone size={16} aria-hidden="true" />
          Call
        </a>
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-border px-5 text-sm text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text"
        >
          <FiMessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
      </div>

      {/* Which listing */}
      {viewing.property && (
        <div className="mt-8 rounded-lg border border-border bg-surface-raised p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Property</p>
          <Link
            href={`/property/${viewing.property.slug}`}
            target="_blank"
            className="mt-1 block text-ink transition-colors duration-200 hover:text-accent-text"
          >
            {viewing.property.title} ({viewing.property.reference})
          </Link>
        </div>
      )}

      {/* Response controls */}
      <div className="mt-10 space-y-4 border-t border-border pt-8">
        <div>
          <label htmlFor="responseMessage" className="mb-1.5 block text-sm text-ink-soft">
            Message to the prospect
          </label>
          <textarea
            id="responseMessage"
            rows={3}
            value={responseMessage}
            onChange={(event) => setResponseMessage(event.target.value)}
            placeholder="Included in the email they receive."
            className="w-full max-w-2xl rounded border border-border bg-surface-raised p-3 text-ink"
          />
        </div>

        <div>
          <label htmlFor="viewing-notes" className="mb-1.5 block text-sm text-ink-soft">
            Internal notes
          </label>
          <textarea
            id="viewing-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full max-w-2xl rounded border border-border bg-surface-raised p-3 text-ink"
          />
        </div>

        {/* Reschedule needs a date, so it reveals a field instead of firing straight off. */}
        {rescheduling && (
          <div>
            <label htmlFor="newTime" className="mb-1.5 block text-sm text-ink-soft">
              New date and time
            </label>
            <input
              id="newTime"
              type="datetime-local"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              className="min-h-11 rounded border border-border bg-surface-raised px-3 text-ink"
            />
            <div className="mt-3 flex gap-3">
              <Button onClick={onReschedule} loading={pending === "rescheduled"}>
                Confirm new time
              </Button>
              <Button variant="secondary" onClick={() => setRescheduling(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Whole-action failure, including a rejected transition. */}
        {actionError && (
          <p role="alert" className="text-sm text-danger">
            {actionError}
          </p>
        )}

        {/* Only the transitions legal from the current status. */}
        <div className="flex flex-wrap gap-3 pt-2">
          {actions.length === 0 ? (
            <p className="text-sm text-muted">
              This viewing is {STATUS_LABELS[viewing.status].toLowerCase()} — no further
              action is possible.
            </p>
          ) : (
            actions.map((action) =>
              action.status === "rescheduled" ? (
                <Button
                  key={action.status}
                  variant={action.tone}
                  onClick={() => setRescheduling(true)}
                >
                  {action.label}
                </Button>
              ) : (
                <Button
                  key={action.status}
                  variant={action.tone}
                  loading={pending === action.status}
                  onClick={() => applyStatus(action.status)}
                >
                  {action.label}
                </Button>
              ),
            )
          )}

          {/* Administrator-only. The API enforces this regardless. */}
          {user.role === "administrator" && (
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this viewing?"
        body="This permanently erases the prospect's name, phone number and email. It cannot be undone, and there is no restore."
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/admin/ViewingDetail.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Create `frontend/src/app/admin/(panel)/viewings/page.js`**

```jsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getViewings } from "@/lib/api/admin";
import MasterDetail from "@/components/admin/MasterDetail";
import ViewingList from "@/components/admin/ViewingList";
import ViewingDetail from "@/components/admin/ViewingDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { STATUS_LABELS } from "@/lib/viewingTransitions";

/**
 * The viewing diary.
 *
 * Defaults to upcoming-only, which is the view a staff member wants on arrival. Like
 * the inbox, selection and filters live in the URL.
 */

const STATUS_TABS = ["", "requested", "accepted", "rescheduled", "completed"];

export default function AdminViewingsPage() {
  const router = useRouter();
  const params = useSearchParams();

  const selectedId = params.get("id");
  const status = params.get("status") ?? "";
  // Absent means upcoming-only; "false" is the explicit opt-out for seeing history.
  const upcoming = params.get("upcoming") !== "false";

  const { data, loading, refetch } = useAdminResource(
    () =>
      getViewings({
        status: status || undefined,
        upcoming: upcoming || undefined,
        limit: 50,
      }),
    [status, upcoming],
  );

  /** Build the next URL, preserving whatever we aren't changing. */
  const navigate = (changes) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    router.push(`/admin/viewings?${next.toString()}`);
  };

  const list = (
    <div>
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border p-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab || "all"}
            type="button"
            // Clear the selection: the chosen viewing may not survive the new filter.
            onClick={() => navigate({ status: tab, id: null })}
            className={`min-h-9 cursor-pointer rounded px-3 text-sm transition-colors duration-200 ${
              status === tab
                ? "bg-accent/10 text-accent-text"
                : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {tab ? STATUS_LABELS[tab] : "All"}
          </button>
        ))}
      </div>

      {/* Past viewings are hidden by default but must remain reachable. */}
      <div className="border-b border-border p-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(event) =>
              navigate({ upcoming: event.target.checked ? null : "false", id: null })
            }
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          Upcoming only
        </label>
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <ViewingList
          viewings={data?.viewings ?? []}
          selectedId={selectedId}
          onSelect={(id) => navigate({ id })}
        />
      )}
    </div>
  );

  return (
    <MasterDetail
      hasSelection={Boolean(selectedId)}
      onClearSelection={() => navigate({ id: null })}
      list={list}
      detail={
        selectedId ? (
          <ViewingDetail
            // Fresh mount per viewing, so form state cannot carry over.
            key={selectedId}
            id={selectedId}
            onChanged={refetch}
            onDeleted={() => {
              navigate({ id: null });
              refetch();
            }}
          />
        ) : null
      }
    />
  );
}
```

- [ ] **Step 7: Verify against real data**

Submit a viewing request through a public listing page, then open `/admin/viewings`.

Expected: it appears under Requested; selecting it offers Accept, Decline, Propose new
time and Cancel; accepting sets Scheduled for to the requested time and the status badge
flips to Accepted; the action buttons then change to Mark completed, Cancel and Propose
new time; unchecking "Upcoming only" reveals past viewings.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin "frontend/src/app/admin/(panel)/viewings"
git commit -m "feat(frontend): viewing diary"
```

---

## Task 11: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the status block**

Move the admin shell, dashboard, enquiry inbox and viewing diary out of "Not built".
Leave listings management, staff management, settings admin, media upload and the blog.
Update the frontend test count to the new total.

- [ ] **Step 2: Add a frontend admin conventions section**

After the existing frontend conventions, document:

- The `(site)` / `admin` route-group split, and that `sitemap.js` / `robots.js` stay at
  `app/` root while `not-found.js` and `error.js` live in `(site)`.
- **Admin is client-rendered; the public site is server-rendered.** The split is
  deliberate — the admin has no SEO need and cookie auth is already wired into the Axios
  instance. Don't "fix" the inconsistency.
- The three auth layers, and that **Proxy (`src/proxy.js`, Next 16's renamed
  Middleware) is an optimistic check only** — never authorization.
- Admin reads go through `useAdminResource`; mutations call `lib/api/admin.js` directly
  then `refetch()`. There is no optimistic update, on purpose.
- **`lib/viewingTransitions.js` mirrors the backend table** with one-way authority: it
  decides which buttons render, the backend decides what is allowed. Never invert this.
- Role-gated controls are courtesy, not security — the API enforces permissions.

- [ ] **Step 3: Verify and commit**

Run: `cd frontend && npm run lint && npm test`
Expected: lint silent; all suites pass.

```bash
git add CLAUDE.md
git commit -m "docs: document the admin panel conventions"
```

---

## Self-review notes

**Spec coverage:** §3 routes (Tasks 6, 7, 9, 10) · §4 three auth layers (Tasks 2, 5) ·
§5 fetching (Tasks 3, 5) · §6.1 login (6) · §6.2 dashboard (7) · §6.3 inbox (9) ·
§6.4 diary (10) · §7 shell and route-group split (Tasks 1, 7) · §8 file list (all) ·
§9 testing (Tasks 3, 4, 5, 9, 10).

**Deviation from the spec's file list:** `StatusSelect.jsx` was dropped. The spec listed
it as shared, but the enquiry status control and the viewing transition buttons turned
out to have nothing in common — one is a `<select>` of four states, the other is a set of
buttons driven by a transition table. Extracting a component to cover both would be
indirection with no reuse. The enquiry select lives inline in `EnquiryDetail`.

**Dependency order:** Tasks 1–5 are prerequisites. Task 9 and Task 10 are independent of
each other and both depend on 3, 4, 5 and 8.

**No new dependencies.**

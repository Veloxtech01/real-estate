# Blog — design spec

Date: 2026-09-06
Status: approved, pending implementation

## Purpose

Close the last two "Not built" items tied to editorial content: the admin blog editor
(§4.2) and the public `/blog` section (§4.1, "Blog / market insights (categories,
tags)"). Blog posts exist to drive organic search — cheap-to-produce market commentary
and neighbourhood write-ups are a meaningful share of the traffic that eventually
converts, the same reasoning behind area landing pages (§4.1).

`blogPostModel` ([backend/model/blogPostModel.js](../../../backend/model/blogPostModel.js))
already exists and is unused — nothing reads or writes it yet. No schema changes are
needed for this slice.

## Access control

Per [docs/PROJECT-SCOPE.md §7](../../PROJECT-SCOPE.md#7-roles-and-permissions)'s role
table, blog is listed under the Administrator row ("staff, all listings, all
enquiries, **blog**, site settings, search analytics"); the Agent row only covers own
listings/enquiries/profile. So every `/api/admin/blog` route is
`requireAuth + authorizeRole("administrator")` — no ownership scoping, matching staff
management, not the agent-scoped pattern used for listings/leads.

## Backend

### Public API

| Method | Path              | Notes                                                                                   |
| ------ | ----------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/blog`       | Published, non-deleted, newest-first. `?page&limit` (default 9, cap 24).                 |
| GET    | `/api/blog/:slug` | Full detail. Draft/deleted/unknown slug all 404 identically (matches properties/agents). |

List response fields per post: `title, slug, excerpt, coverImage, categories, tags,
author (populated: name, slug, photo), publishedAt`. Detail adds `body, metaTitle,
metaDescription, ogImage, updatedAt` and populates `author` with
`name slug photo position isPublic isActive` so the frontend can decide whether to
link to `/team/[slug]`.

Both routes apply the public scope unconditionally
(`publicationState: "published", deletedAt: null`) inside the controller, the same
rule the query engine applies for properties.

### Admin API (administrator only)

| Method       | Path                          | Notes                                                        |
| ------------ | ----------------------------- | ------------------------------------------------------------- |
| GET          | `/api/admin/blog`             | Table: `q, publicationState, includeDeleted, page, limit`.    |
| GET          | `/api/admin/blog/:id`         | One full record — the editor's load.                         |
| POST         | `/api/admin/blog`             | Create.                                                       |
| PATCH        | `/api/admin/blog/:id`         | Update; re-slugs on title change.                             |
| DELETE       | `/api/admin/blog/:id`         | **Soft** delete (`deletedAt` set, `publicationState` forced to `draft`). |
| POST         | `/api/admin/blog/:id/restore` | Undo a soft delete.                                           |

`WRITABLE_FIELDS`: `title, excerpt, body, coverImage, author, categories, tags,
metaTitle, metaDescription, ogImage`. `slug`, `publishedAt`, `deletedAt` are always
server-controlled, same discipline as `adminPropertyController`.

- **Slug**: generated from `title` via `slugify()`, with a numeric `-2`, `-3`, …
  suffix on collision — the same inline pattern `adminStaffController`'s
  `uniqueAgentSlug` already uses, not a new shared utility (this codebase inlines this
  small helper per-controller rather than centralising it).
- **Soft delete, not hard**: a post's URL may be linked from elsewhere (another post,
  an external backlink), so removing it must not surface as a different 404 than "was
  never here" would suggest to a returning visitor with the old link — consistent with
  Property's reasoning, distinct from the leads' hard-delete/NDPA case.
- **Publish stamps `publishedAt` once**: already handled by the model's existing
  `pre("save")` hook — no controller change needed for that behaviour.

## Frontend — public

- `frontend/src/lib/api/server.js`: add `getBlogPosts({ page, limit })` (revalidate 300,
  tag `"blog"`) and `getBlogPost(slug)` (revalidate 300, tags `"blog", "blog:<slug>"`),
  following the existing `getProperties`/`getProperty` shape exactly.
- `/blog` (`frontend/src/app/(site)/blog/page.js`, SSR, `?page=`) — grid of `BlogCard`s
  (title, excerpt, coverImage, categories as chips, publish date). Empty state message
  when there are no published posts yet (a fresh client copy has none), same pattern as
  Team's empty roster.
- `/blog/[slug]` (`frontend/src/app/(site)/blog/[slug]/page.js`, SSR) — `notFound()`
  when `getBlogPost` returns null. Renders `body` through `react-markdown` (new
  dependency — see below). Author block (name, position, photo) links to
  `/team/[slug]` only when `author.isPublic && author.isActive`; otherwise renders the
  name as plain text; renders nothing when there is no author. `generateMetadata` uses
  `metaTitle ?? title` and `metaDescription ?? excerpt`, matching Team's fallback
  pattern; `ogImage ?? coverImage` for the Open Graph image.
- Header nav: add a `/blog` link (footer/nav only link to routes that exist, per
  convention — this one now does).
- `frontend/src/app/sitemap.js`: add a paginated walk over `getBlogPosts` alongside the
  existing listings walk, each entry `changeFrequency: "weekly"`.

**New dependency: `react-markdown`.** Renders Markdown to React elements without
executing embedded raw HTML by default, so it's safe against a compromised or
careless admin account writing something injectable — no separate sanitizer needed.
Flagged per CLAUDE.md's "no new dependencies without flagging."

## Frontend — admin

- `frontend/src/lib/api/admin.js`: add `getBlogPosts(params)`, `getBlogPost(id)`,
  `createBlogPost(body)`, `updateBlogPost(id, body)`, `deleteBlogPost(id)`,
  `restoreBlogPost(id)` wrappers — same unwrap-`data.data` shape as the staff
  wrappers.
- `/admin/blog` (`frontend/src/app/admin/(panel)/blog/page.js`) — table screen mirroring
  `/admin/properties`' filter bar exactly: `publicationState` tabs (`""`, `draft`,
  `published`), a `q` search box (Enter to submit), an `includeDeleted` checkbox,
  pagination — all state in the URL, changing a filter resets to page 1.
- `BlogTable` component — columns: title, publicationState badge, author name,
  updatedAt, actions (Edit / soft-delete or restore depending on `deletedAt`). Confirm
  dialog before delete, wording says "This post's page will stop being served, but can
  be restored" (reversible, unlike a lead's), matching `PropertyTable`'s existing
  soft-delete confirmation wording.
- `BlogForm` (`frontend/src/components/admin/BlogForm.jsx`, one component for
  create+edit, keyed by whether `blogPost` is passed — same split as `StaffForm`):
  - `title`, `excerpt` (textarea, optional), `body` (larger textarea, required,
    Markdown source, no live preview — YAGNI, matches the plain-textarea `bio` field
    elsewhere), `coverImage` (URL text input, optional).
  - `author` — `<select>` sourced from `GET /api/admin/reference`'s `staff` list
    (already returned for the staff-role dropdown), optional ("No author" as the
    empty option).
  - `categories`, `tags` — plain text inputs, comma-separated
    (`"Market Trends, Lekki"` → `["Market Trends", "Lekki"]`), split/trim/filter-empty
    on submit, joined with `", "` as the default value when editing. This is a new
    small pattern in this codebase (Property's "tags" field is actually taxonomy
    checkboxes, not free text) — no existing control to reuse.
  - `metaTitle`, `metaDescription`, `ogImage` — same "Search appearance" style fields
    already used for properties, just without a dedicated section wrapper (this form
    isn't long enough to need PropertyForm's nine-section split).
  - `publicationState` — a Draft/Published toggle, same as `PropertyForm`'s.
  - Field-path errors from the API's `details` map onto inputs via the existing
    `mapApiErrors` helper; unmatched errors go to a form-level banner, matching every
    other admin form.
- `AdminSidebar`: add `{ href: "/admin/blog", label: "Blog", icon: FiFileText }` to the
  administrator-only branch, alongside Staff.

## Deferred (out of scope for this slice)

- **`locations` cross-linking** — the model field stays, unused. No multi-select
  control exists in this codebase yet (StaffForm deferred `areas` for the same
  reason), and neighbourhood pages themselves are also unbuilt, so there's nothing to
  cross-link to today.
- **Category/tag archive pages** (`/blog/category/[x]`, `/blog/tag/[x]`) — chips are
  informational only, not clickable filters, matching the YAGNI bar Team already set
  (no filtering there either).
- **Cloudinary cover-image upload** — `coverImage` is a plain URL field, same
  deferral `StaffForm` made for `agentModel.photo`. Wiring the signed-upload flow to a
  single-image field is its own slice if wanted later.
- **Agent-authored posts** — `author` can be assigned to any staff member from the
  admin form, but agents cannot write their own posts through this slice; only
  administrators reach `/admin/blog` at all.

## Testing

- Backend: `backend/tests/api.adminBlog.test.js` mirroring
  `api.adminStaff.test.js`'s structure — role enforcement (401/403) on every route,
  create (slug generation + collision suffix, validation errors), update (re-slug on
  title change, publish stamps `publishedAt` once), soft delete + restore, and a
  regression test that the public `/api/blog` list/detail never returns a draft or
  soft-deleted post. Plus `backend/tests/api.blog.test.js` for the public routes
  (pagination, 404 parity for draft/deleted/unknown).
- Frontend: `BlogForm.test.jsx` and `BlogTable.test.jsx` mirroring the Staff
  equivalents; a page-level test for `/blog` and `/blog/[slug]` rendering, following
  existing Team/Testimonials test patterns.

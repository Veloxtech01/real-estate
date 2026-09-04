# Property media: demo imagery + Cloudinary upload

**Date:** 2026-09-04
**Status:** Approved, not yet implemented

Two slices, built in order. Part A makes the demo data look like a real estate site.
Part B closes the §4.2 media gap so the agency can add its own photographs.

---

## Problem

Every demo listing carries three `https://placehold.co/1200x800?text=Property+N+Image+M`
stubs, imported from `nigerian_real_estate_dummy_data_200.json`. The rendering path is
complete — `PropertyCard`, `PropertyGallery`, `coverImageOf`, JSON-LD and Open Graph all
consume media correctly — so the site is structurally finished and visually empty.

Separately, there is no way to add a photograph at all. `propertyMediaModel` is fully
specified (`publicId`, `thumbnailUrl`, `watermarkedUrl`, `blurDataUrl`, dimensions,
`displayOrder`), `cloudinary` and `multer` are installed, but `config/cloudinary.js` does
not exist and no upload endpoint is mounted. `CoverImagePicker` can only choose among
media that already exists.

---

## Part A — Demo imagery

### Source

The **Pexels API answers unauthenticated requests** (verified: `GET
https://api.pexels.com/v1/search?query=house&per_page=1` returns 200 with no key), returns
high-quality real-estate photography, and permits hotlinking `images.pexels.com`
commercially without attribution. Openverse (`api.openverse.org`, also keyless,
CC-licensed) is the fallback if Pexels ever starts requiring a key.

Attribution is not required but is recorded anyway in `frontend/public/CREDITS.md`,
alongside the existing `hero-home.jpg` credit.

### `backend/scripts/fetchDemoImages.js` — generator

Run by hand, not by the seed. Queries Pexels across per-category search terms,
`HEAD`-verifies every candidate URL returns 200, and writes `backend/scripts/demoImages.js`.

Categories and their queries:

| Category     | Queries                                                             |
| ------------ | ------------------------------------------------------------------- |
| `exterior`   | modern house exterior, luxury home exterior, duplex house, villa     |
| `interior`   | living room interior, modern kitchen, bedroom interior, bathroom     |
| `land`       | empty land plot, vacant lot, land for sale, cleared field            |
| `commercial` | office building, retail shop front, warehouse interior, office space |

Target ~20 verified photos per category (~80 total), enough that 200 listings x 3 images
do not visibly repeat within a results page.

### `backend/scripts/demoImages.js` — committed catalogue

A plain ESM module exporting an object keyed by category. Each entry:

```js
{
  url: "https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg",
  width: 1200,
  height: 800,
  alt: "Modern house exterior",
  photographer: "Robert So",
  sourceUrl: "https://www.pexels.com/photo/...-20296321/",
}
```

**Static rather than fetched at seed time.** Seeding runs inside tests and against live
clusters; a rate-limited third-party call inside `--demo` would make it flaky and
non-deterministic. The generator exists so the catalogue can be refreshed deliberately.

### `importDemoListings.js` changes

Replaces the `images` array read from the demo JSON with a catalogue lookup:

1. Category is chosen from the listing's `propertyType` — `land` maps to `land`;
   commercial/office/shop/warehouse map to `commercial`; everything else gets one
   `exterior` followed by two `interior`.
2. Selection is deterministic: a numeric hash of the listing `reference` gives a start
   index into the category array, and the three picks step forward from it, so a listing
   never gets the same photo twice and re-seeding produces the same gallery.
3. `width` and `height` come from the catalogue rather than being invented, so the
   layout-shift reservation is real. `alt` combines both — `"<listing title> — <catalogue
   alt>"`, e.g. `"4 Bedroom Duplex, Lekki Phase 1 — modern house exterior"` — because the
   catalogue alone does not identify the listing and the old title-only alt did not
   describe the picture.
4. `thumbnailUrl` appends Pexels' own `?auto=compress&cs=tinysrgb&w=400`.

The demo JSON's `images` field is ignored, not deleted — the file is source data.

### Frontend changes

- `frontend/next.config.mjs`: add `{ protocol: "https", hostname: "images.pexels.com" }`.
  `placehold.co` stays — `coverImageOf`'s tests and any un-reseeded database still use it.
- `frontend/public/CREDITS.md`: a Pexels section noting the licence and that these are
  **demo images that must be replaced before a client launch**.

---

## Part B — Media upload

### Transport: signed direct-to-Cloudinary

The browser uploads straight to Cloudinary, not through the API. Scope §10.3 requires
chunked, resumable uploads because agents upload 8MB phone photos over connections that
drop; proxying through Node would cross the network twice, hit Render's body limits, and
give no resume.

Flow:

```
browser                      API                        Cloudinary
   |  POST .../media/signature |                             |
   |-------------------------->| ownership check             |
   |<--------------------------| {signature, folder, ...}    |
   |                                                         |
   |  POST /v1_1/<cloud>/image/upload (chunked, w/ progress) |
   |-------------------------------------------------------->|
   |<--------------------------------------------------------|
   |  POST .../media  {publicId}                             |
   |-------------------------->| api.resource(publicId) ---->|
   |                           |<---- asset metadata --------|
   |<--------------------------| PropertyMedia record        |
```

### Backend

**`config/cloudinary.js`**
Configures the SDK from `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`. Exports the
configured `cloudinary` plus `isCloudinaryConfigured()`. The API must still boot with the
vars blank — same tolerance as `config/db.js` — and media endpoints return 503 rather than
crashing the process.

**`utils/mediaSignature.js`**
Builds signed upload params. The signature pins:

- `folder: properties/<reference>` — the listing's own folder, so a signature for one
  listing cannot upload into another's,
- `allowed_formats: jpg,jpeg,png,webp,avif`,
- `max_file_size`,
- `eager` transformations producing the thumbnail (and later the watermark),
- a short `timestamp` expiry.

**`controllers/adminMediaController.js`** — all routes `requireAuth` plus the §7 ownership
scoping already used by `adminPropertyController`, and 403 (not 404) on an ownership
violation, matching the lead-operations rule.

| Method | Path                                        | Notes                                        |
| ------ | ------------------------------------------- | -------------------------------------------- |
| POST   | `/api/admin/properties/:id/media/signature` | `strictLimiter` — every call authorises spend |
| POST   | `/api/admin/properties/:id/media`           | Registers an uploaded asset                  |
| PATCH  | `/api/admin/properties/:id/media/order`     | `{ ids: [...] }` to bulkWrite `displayOrder` |
| PATCH  | `/api/admin/properties/:id/media/:mediaId`  | Alt text only                                |
| DELETE | `/api/admin/properties/:id/media/:mediaId`  | Destroys in Cloudinary, then the record      |

**The registration endpoint is the security hinge.** The client sends only a `publicId`.
The controller calls `cloudinary.api.resource(publicId)` and:

1. rejects a `publicId` whose folder is not this listing's — otherwise a staff member could
   register a colleague's asset, or any asset in the account, against their own listing;
2. reads `secure_url`, `width`, `height`, `bytes`, `format` **from Cloudinary's response,
   never from the request body** — client-supplied dimensions would let a caller poison the
   layout-shift reservation, and a client-supplied URL would make the record point anywhere.

`PATCH .../order` validates that every id in the array belongs to this listing before
writing, and that the array is a permutation of the listing's media — a partial array would
silently leave stale `displayOrder` values.

`DELETE` clears `Property.coverImage` when it referenced the deleted record; a dangling
cover reference makes `coverImageOf` fall through to the placeholder with no explanation.
Cloudinary destruction happens first: an orphaned Cloudinary asset costs money forever,
whereas an orphaned DB row is visible and fixable.

`displayOrder` for a new upload is `max + 1` within the listing, computed server-side.

### Frontend

**`lib/api/admin.js`** — the five new URLs. As with every other admin call, no URL is built
at a call site.

**`lib/uploadMedia.js`** — the browser upload, outside React: requests a signature, `POST`s
to Cloudinary via `XMLHttpRequest` (needed for upload progress; `fetch` has no
request-progress event), splitting into 6MB chunks with `Content-Range` and a shared
`X-Unique-Upload-Id` when the file exceeds 20MB, then registers the result. Returns a
promise plus an `abort()`.

**`components/admin/MediaManager.jsx`** — replaces `CoverImagePicker` inside `MediaSection`:
a drop zone, a drag-reorderable grid, per-tile alt text, delete with confirmation, and the
cover radio the picker already implements. `CoverImagePicker` is absorbed and deleted rather
than left alongside — two components owning the same grid would drift.

Drag reorder is native HTML5 drag-and-drop, keyboard-accessible via move-left/move-right
buttons on each tile. No new dependency.

**Uploads commit immediately, independently of the form's Save.** A photo is a file on a
server, not a form field: making it wait for Save means a failed validation elsewhere in a
nine-section form discards a completed upload. Cover selection stays a react-hook-form
field, because it is a property of the listing.

**`/admin/properties/new` cannot upload.** There is no listing id, so no folder and no
ownership check. The section tells the user to save the listing first. The alternative —
uploading to a temporary folder and moving it on save — orphans assets whenever a draft is
abandoned.

### Errors

- Cloudinary unconfigured: 503 with a plain message; the editor shows it inline and the
  rest of the form still works.
- Upload failure or abort: the tile shows a retry, and no DB record is written. A failed
  upload leaves nothing behind.
- A 400 from registration surfaces through `lib/apiErrors.js` like every other admin error.

---

## Testing

**Backend** (mocked `cloudinary` SDK — no network in tests):

- signature is scoped to the listing's folder, and refuses a listing the caller does not own
- registration rejects a `publicId` outside the listing's folder
- registration ignores client-supplied `url`/`width`/`height` and uses the SDK's values
- reorder rejects ids belonging to another listing, and rejects a partial permutation
- delete clears `coverImage` when it pointed at the deleted record
- unconfigured Cloudinary returns 503, and the app still boots
- agent ownership: 403 on another agent's listing

**Frontend**:

- `MediaManager` renders a gallery, marks the cover, reorders by keyboard, and confirms
  delete
- `uploadMedia` happy path, chunked path, and failure leaves no registration call
- `MediaSection` on a new listing shows the save-first message and no drop zone

---

## Documentation

- `docs/API-REFERENCE.md` — the five endpoints with response shapes captured from the
  running API, and media removed from the "Not built yet" list.
- `CLAUDE.md` — Status block (media upload no longer a gap), the admin endpoint table, and
  a conventions note covering the registration-verification rule and upload-outside-Save.
- `backend/.env.example` — already lists the three Cloudinary vars; no change needed.

---

## Deviations made during implementation

- **The Pexels API needs a key after all.** The spec said it answers unauthenticated
  requests, based on two probes that happened to succeed. It does not hold: the keyless
  quota is a handful of requests, after which every call returns 401 for minutes, so a
  sixteen-query run cannot complete. `fetchDemoImages.js` now requires `PEXELS_API_KEY`
  (free, instant) and refuses to run without it. The key is generator-time only — it never
  reaches the running API, the seed, or the browser.
- **No chunked or resumable upload path was built.** The transport section described one
  for files over 20MB. Uploads are capped at 15MB instead, which sits under Cloudinary's
  20MB single-request limit and removes the need — a `Content-Range` branch that never
  executes is a branch that is never right. If the cap is ever raised past 20MB, that is
  when chunking gets written and tested.
- **`maxFileSize` is advisory, not signed.** Cloudinary's `max_file_size` upload parameter
  requires an authenticated upload preset, and signing a parameter the endpoint does not
  accept fails every upload with "Invalid Signature". The browser uses it to reject
  oversized files before spending a rate-limited signature call; the real byte count is
  read back from Cloudinary at registration.
- **`mediaByReference` was removed from `importDemoListings.js`** rather than kept — it
  carried nothing but the now-unused `images` array.

## Deferred

- **Watermarking.** §4.2 asks for it and the `eager` slot is wired, but the overlay needs a
  client logo asset that does not exist. `watermarkedUrl` stays unset rather than pointing
  at an unwatermarked file.
- **`blurDataUrl`.** Cloudinary can generate one, but nothing consumes it yet;
  `PropertyCard` reserves space with a fixed aspect ratio instead.
- **Video.** Explicitly out of scope for this slice.
- **Floor plan file upload.** Stays a URL field.

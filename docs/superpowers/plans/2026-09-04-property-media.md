# Property Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo listings' grey `placehold.co` stubs with real property photography, then build signed direct-to-Cloudinary photo upload into the admin listing editor.

**Architecture:** Part A adds a committed, hand-refreshed catalogue of verified Pexels CDN URLs that `importDemoListings.js` assigns deterministically by property type — seeding stays offline and reproducible. Part B has the browser upload straight to Cloudinary under a server-issued signature scoped to the listing's own folder, then register the result with an API that re-reads the asset from Cloudinary rather than trusting the request body.

**Tech Stack:** Express 5, Mongoose 9, `cloudinary` v2 SDK, Next.js 16 App Router, React 19, react-hook-form, Vitest + supertest + mongodb-memory-server (backend), Vitest + Testing Library + jsdom (frontend).

**Spec:** [docs/superpowers/specs/2026-09-04-property-media-design.md](../specs/2026-09-04-property-media-design.md)

## Global Constraints

- **Comment everything.** Per `CLAUDE.md`: a block comment above every function, component, hook, controller, middleware and model saying what it does, what it takes and what it returns; inline comments on non-obvious branches, queries and error paths; comments on JSX regions. Explain *why*, not *what*.
- **Response shape is fixed.** Success `{ success: true, data: {...} }`; failure `{ success: false, message, details? }`. Never hand-roll another shape.
- **Throw `new ApiError(status, message, details?)`** from `backend/utils/ApiError.js`. Never `res.status(...).json(...)` on a failure path. Express 5 forwards async throws — no try/catch wrapper.
- **Backend is ESM** (`"type": "module"`) — `import`, and relative imports carry the `.js` extension.
- **Mongoose 9:** `pre`/`post` hooks take no `next()` callback and must be `async`.
- **No new dependencies.** `cloudinary` and `multer` are already installed; `multer` is not used by this plan (direct upload). Drag-and-drop is native HTML5 — do not add `dnd-kit` or `react-beautiful-dnd`.
- **Every admin URL lives in `frontend/src/lib/api/admin.js`.** Never build one at a call site.
- **Ownership violations under `/api/admin` return 403, not 404.** These are authenticated colleagues. The public surface still 404s.
- **Tailwind v4** — no `tailwind.config.js`; theme tokens are in `frontend/src/app/globals.css`. Use existing semantic tokens (`text-ink`, `text-ink-soft`, `text-muted`, `border-border`, `bg-surface-raised`, `text-danger`, `border-accent`).
- **React 19** — no `import React` for JSX; `ref` is a plain prop.
- Backend tests run with `cd backend && npm test`; frontend with `cd frontend && npm test`. Both packages must stay lint-clean (`npm run lint`).
- Current baseline: **202/202 backend tests, 124/124 frontend tests pass.** Every task must leave both suites green.

---

## File Structure

**Part A — demo imagery**

| File | Responsibility |
| --- | --- |
| `backend/scripts/fetchDemoImages.js` (create) | Hand-run generator. Queries Pexels, HEAD-verifies each URL, writes `demoImages.js`. Never imported by the seed. |
| `backend/scripts/demoImages.js` (create) | Generated, committed data only: `export const DEMO_IMAGES = { exterior, interior, land, commercial }`. No logic — the generator overwrites it. |
| `backend/scripts/demoGallery.js` (create) | Hand-written selection logic: `galleryFor()`. Separate from the generated file so a refresh cannot clobber it. |
| `backend/scripts/importDemoListings.js` (modify) | Builds media docs from the catalogue instead of the demo JSON's `images` array. |
| `backend/tests/demoGallery.test.js` (create) | Catalogue shape + deterministic, non-repeating selection. |
| `frontend/next.config.mjs` (modify) | Allow `images.pexels.com` in `next/image`. |
| `frontend/public/CREDITS.md` (modify) | Pexels attribution + replace-before-launch warning. |

**Part B — media upload**

| File | Responsibility |
| --- | --- |
| `backend/config/cloudinary.js` (create) | SDK configuration from env + `isCloudinaryConfigured()`. Boots fine with blank vars. |
| `backend/utils/mediaSignature.js` (create) | Builds the scoped, signed upload params and derives/validates a listing's folder. |
| `backend/controllers/adminMediaController.js` (create) | The five handlers. |
| `backend/routes/adminMediaRoutes.js` (create) | `mergeParams` router mounted at `/:id/media` inside the property router. |
| `backend/routes/adminPropertyRoutes.js` (modify) | Mounts the media router. |
| `backend/tests/mediaSignature.test.js` (create) | Folder derivation + signature scoping, no network. |
| `backend/tests/api.adminMedia.test.js` (create) | The five endpoints, with a mocked Cloudinary SDK. |
| `frontend/src/lib/api/admin.js` (modify) | Five new wrappers. |
| `frontend/src/lib/uploadMedia.js` (create) | Browser upload: signature → Cloudinary XHR (chunked, with progress) → register. |
| `frontend/src/components/admin/MediaManager.jsx` (create) | Drop zone, drag-reorder grid, alt text, delete, cover radio. |
| `frontend/src/components/admin/property/MediaSection.jsx` (modify) | Renders `MediaManager` instead of `CoverImagePicker`. |
| `frontend/src/components/admin/CoverImagePicker.jsx` (delete) | Absorbed into `MediaManager`. |
| `frontend/src/lib/uploadMedia.test.js` (create) | Upload orchestration, mocked XHR. |
| `frontend/src/components/admin/MediaManager.test.jsx` (create) | Render, reorder, delete, save-first state. |
| `docs/API-REFERENCE.md`, `CLAUDE.md` (modify) | Endpoints and status. |

---

# Part A — Demo imagery

## Task 1: Demo image catalogue and its generator

**Files:**
- Create: `backend/scripts/fetchDemoImages.js`
- Create: `backend/scripts/demoImages.js` (produced by running the generator)

**Interfaces:**
- Consumes: nothing.
- Produces: `export const DEMO_IMAGES` — an object with exactly the keys `exterior`, `interior`, `land`, `commercial`. Each value is an array of
  `{ url: string, thumbnailUrl: string, width: 1200, height: 800, alt: string, photographer: string, sourceUrl: string }`.

**Background the implementer needs:**

The Pexels API answers **unauthenticated** requests — verified: `GET https://api.pexels.com/v1/search?query=house&per_page=1` returns 200 with no `Authorization` header. Do not add an API key or an env var for one.

Pexels' CDN takes sizing params, and they are honoured exactly — verified: `https://images.pexels.com/photos/20296321/pexels-photo-20296321.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop` returns a JPEG measuring precisely 1200x800. That is why the catalogue can record `width: 1200, height: 800` honestly; those numbers reserve layout space in `PropertyCard` and a wrong value causes content shift.

- [ ] **Step 1: Write the generator**

`backend/scripts/fetchDemoImages.js` — a hand-run CLI, executed as `node scripts/fetchDemoImages.js`. It is **never imported by `seed.js` or `importDemoListings.js`**; seeding must not touch the network.

Responsibility: search Pexels per category, verify every candidate URL, and write `backend/scripts/demoImages.js`.

Constraints:
- Queries, verbatim:

```js
const QUERIES = {
  exterior: ["modern house exterior", "luxury home exterior", "duplex house", "villa house"],
  interior: ["living room interior", "modern kitchen", "bedroom interior", "bathroom interior"],
  land: ["empty land plot", "vacant lot", "land for sale", "cleared field"],
  commercial: ["office building", "retail shop front", "warehouse interior", "office space"],
};
```

- Request `https://api.pexels.com/v1/search?query=<encoded>&per_page=8&orientation=landscape` with **no** `Authorization` header.
- Build `url` as `` `${photo.src.original}?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop` `` and `thumbnailUrl` with `w=400&h=300` instead. `photo.src.original` is already an `images.pexels.com` URL with no query string.
- `alt` comes from Pexels' `photo.alt` when non-empty, else the query string that found it. Lowercase it — Task 2 composes it into a sentence after an em dash.
- `photographer` is `photo.photographer`; `sourceUrl` is `photo.url`.
- **Verify before keeping:** issue a `HEAD` (via `fetch(url, { method: "HEAD" })`) against the composed `url` and drop anything that is not 200. An unverified URL becomes a broken image in every gallery it lands in.
- De-duplicate by Pexels photo id across queries within a category — the same photo often ranks for two queries, and a duplicate defeats Task 2's non-repetition guarantee.
- Target **at least 12** kept entries per category; exit non-zero with a clear message if a category falls short, rather than writing a thin catalogue that repeats.
- Write the file with a header comment marking it **generated — do not edit by hand**, naming the generator, and stating the date.

- [ ] **Step 2: Run the generator**

Run: `cd backend && node scripts/fetchDemoImages.js`
Expected: prints a per-category kept/rejected count, all four categories at 12+, and writes `backend/scripts/demoImages.js`.

- [ ] **Step 3: Verify the written catalogue parses and every URL is live**

Run:

```bash
cd backend && node -e "
import('./scripts/demoImages.js').then(async ({ DEMO_IMAGES }) => {
  const all = Object.values(DEMO_IMAGES).flat();
  console.log('categories', Object.keys(DEMO_IMAGES).join(','), 'total', all.length);
  const bad = [];
  for (const item of all) {
    const res = await fetch(item.url, { method: 'HEAD' });
    if (!res.ok) bad.push(item.url);
  }
  console.log('broken', bad.length, bad);
});
"
```

Expected: `categories exterior,interior,land,commercial total 48` (or more) and `broken 0 []`.

- [ ] **Step 4: Lint**

Run: `cd backend && npm run lint`
Expected: clean, no output.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/fetchDemoImages.js backend/scripts/demoImages.js
git commit -m "feat(seed): verified Pexels demo image catalogue and its generator"
```

---

## Task 2: Deterministic gallery selection

**Files:**
- Create: `backend/scripts/demoGallery.js`
- Test: `backend/tests/demoGallery.test.js`

**Interfaces:**
- Consumes: `DEMO_IMAGES` from `backend/scripts/demoImages.js` (Task 1).
- Produces:
  - `export function categoriesFor(propertyType: string): string[]` — exactly three category names.
  - `export function galleryFor(reference: string, propertyType: string, title: string): Array<{ url, thumbnailUrl, width, height, alt, photographer, sourceUrl }>` — exactly three entries.

**Why this file is separate from `demoImages.js`:** the generator overwrites `demoImages.js` wholesale. Selection logic living there would be destroyed on the next refresh.

- [ ] **Step 1: Write the failing test**

`backend/tests/demoGallery.test.js`:

```js
import { describe, it, expect } from "vitest";

import { DEMO_IMAGES } from "../scripts/demoImages.js";
import { categoriesFor, galleryFor } from "../scripts/demoGallery.js";
import { PROPERTY_TYPES } from "../utils/constants.js";

/**
 * Demo gallery selection.
 *
 * These images are the entire visual impression the demo site makes, so the cases
 * that matter are the ones a reader would notice: the same photo twice in one
 * gallery, a bathroom photo on a land listing, or a re-seed that shuffles every
 * listing's pictures and makes the diff unreadable.
 */
describe("demo image catalogue", () => {
  it("has the four categories the selector routes to, each with enough photos", () => {
    expect(Object.keys(DEMO_IMAGES).sort()).toEqual([
      "commercial",
      "exterior",
      "interior",
      "land",
    ]);

    // Three picks per listing, so fewer than three would force a repeat. Twelve is
    // the generator's floor and keeps a results page from looking duplicated.
    for (const [category, items] of Object.entries(DEMO_IMAGES)) {
      expect(items.length, category).toBeGreaterThanOrEqual(12);
    }
  });

  it("records honest dimensions and a pexels CDN url for every entry", () => {
    for (const item of Object.values(DEMO_IMAGES).flat()) {
      // The stored width/height reserve layout space in PropertyCard; they are only
      // true because the url pins them with Pexels' own sizing params.
      expect(item.url).toMatch(/^https:\/\/images\.pexels\.com\/photos\//);
      expect(item.url).toContain("w=1200");
      expect(item.url).toContain("h=800");
      expect(item.width).toBe(1200);
      expect(item.height).toBe(800);
      expect(item.thumbnailUrl).toContain("w=400");
      expect(item.photographer).toBeTruthy();
      expect(item.sourceUrl).toBeTruthy();
    }
  });
});

describe("categoriesFor", () => {
  it("gives land listings land photos only", () => {
    expect(categoriesFor("land")).toEqual(["land", "land", "land"]);
  });

  it("gives commercial listings commercial photos only", () => {
    expect(categoriesFor("commercial")).toEqual([
      "commercial",
      "commercial",
      "commercial",
    ]);
  });

  it("leads a residential listing with an exterior, then interiors", () => {
    // The cover is displayOrder 0, so the exterior has to come first — a card
    // fronted by a bathroom reads as a mistake.
    expect(categoriesFor("detached")).toEqual(["exterior", "interior", "interior"]);
  });

  it("returns three known categories for every property type in the enum", () => {
    for (const type of PROPERTY_TYPES) {
      const categories = categoriesFor(type);
      expect(categories, type).toHaveLength(3);
      for (const category of categories) {
        expect(DEMO_IMAGES[category], `${type} -> ${category}`).toBeDefined();
      }
    }
  });
});

describe("galleryFor", () => {
  const title = "4 Bedroom Detached Duplex, Lekki Phase 1";

  it("returns three distinct photos", () => {
    const gallery = galleryFor("REF1042", "detached", title);

    expect(gallery).toHaveLength(3);
    expect(new Set(gallery.map((item) => item.url)).size).toBe(3);
  });

  it("is deterministic, so re-seeding does not reshuffle every listing", () => {
    expect(galleryFor("REF1042", "detached", title)).toEqual(
      galleryFor("REF1042", "detached", title)
    );
  });

  it("varies between listings", () => {
    const a = galleryFor("REF1042", "detached", title);
    const b = galleryFor("REF2099", "detached", title);

    expect(a.map((item) => item.url)).not.toEqual(b.map((item) => item.url));
  });

  it("composes alt text from the listing and the photo", () => {
    const [first] = galleryFor("REF1042", "detached", title);

    // The title alone does not describe the picture; the catalogue alt alone does
    // not identify the listing. Screen readers and image search need both.
    expect(first.alt).toContain(title);
    expect(first.alt).toMatch(/ — /);
    expect(first.alt.length).toBeGreaterThan(title.length + 3);
  });

  it("draws land photos for a land listing", () => {
    const gallery = galleryFor("REF3001", "land", "Plot of Land at Ibeju-Lekki");
    const landUrls = new Set(DEMO_IMAGES.land.map((item) => item.url));

    for (const item of gallery) {
      expect(landUrls.has(item.url)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/demoGallery.test.js`
Expected: FAIL — `Failed to resolve import "../scripts/demoGallery.js"`.

- [ ] **Step 3: Write the implementation**

`backend/scripts/demoGallery.js`

- `categoriesFor(propertyType: string): string[]`
  Responsibility: map a `PROPERTY_TYPES` member onto the three catalogue categories its gallery draws from.
  Constraints:
  - `"land"` → three `land`; `"commercial"` → three `commercial`; **everything else** → `["exterior", "interior", "interior"]`.
  - The fallback is the default arm, not an enumerated list — a property type added to `constants.js` later must still return a valid triple rather than `undefined`.

- `galleryFor(reference: string, propertyType: string, title: string)`
  Responsibility: pick three distinct photos for a listing, reproducibly.
  Constraints:
  - Hash `reference` to a non-negative integer with a small deterministic string hash written inline (e.g. FNV-1a over char codes). **Do not** use `Math.random()`, `Date.now()`, or `crypto.randomUUID()` — a re-seed must produce the identical gallery, or every diff of the demo data churns.
  - The hash gives a start index into the category array; successive picks step forward with `(start + n) % items.length`. Stepping — rather than three independent hashes — is what guarantees no repeat within a gallery when the three categories are the same array.
  - `alt` is `` `${title} — ${item.alt}` ``, an em dash, matching the composed form the test asserts.
  - Return fresh objects, not references into `DEMO_IMAGES`; the caller mutates nothing, but a shared object across 200 listings is a trap waiting for the first `.alt =`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/demoGallery.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/demoGallery.js backend/tests/demoGallery.test.js
git commit -m "feat(seed): deterministic demo gallery selection by property type"
```

---

## Task 3: Wire the catalogue into seeding, and allow the host

**Files:**
- Modify: `backend/scripts/importDemoListings.js` (the media-building block, currently around lines 236-270)
- Modify: `frontend/next.config.mjs`
- Modify: `frontend/public/CREDITS.md`
- Test: `backend/tests/seed.test.js` (extend)

**Interfaces:**
- Consumes: `galleryFor()` from Task 2.
- Produces: `PropertyMedia` documents whose `url` is a Pexels CDN URL with real `width`/`height`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/seed.test.js`, inside the existing demo-import describe block (match the surrounding setup — read the file first; it already connects the DB and runs the importer):

```js
  it("gives every demo listing real photography, not grey placeholders", async () => {
    const media = await PropertyMedia.find({}).lean();

    expect(media.length).toBeGreaterThan(0);

    for (const item of media) {
      // placehold.co stubs were the whole reason the demo site looked unfinished.
      expect(item.url).not.toContain("placehold.co");
      expect(item.url).toMatch(/^https:\/\/images\.pexels\.com\/photos\//);
      // Real dimensions, so next/image reserves the right space and the grid does
      // not reflow as photos arrive.
      expect(item.width).toBe(1200);
      expect(item.height).toBe(800);
      expect(item.thumbnailUrl).toContain("w=400");
      expect(item.alt).toMatch(/ — /);
    }
  });

  it("never repeats a photo within one listing's gallery", async () => {
    const media = await PropertyMedia.find({}).lean();
    const byProperty = new Map();

    for (const item of media) {
      const key = String(item.property);
      if (!byProperty.has(key)) byProperty.set(key, []);
      byProperty.get(key).push(item.url);
    }

    for (const [property, urls] of byProperty) {
      expect(new Set(urls).size, property).toBe(urls.length);
    }
  });
```

Add `PropertyMedia` to the file's imports if it is not already there.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/seed.test.js`
Expected: FAIL — the assertion `expect(item.url).not.toContain("placehold.co")` fails, because the importer still reads the demo JSON's `images` array.

- [ ] **Step 3: Modify the importer**

`backend/scripts/importDemoListings.js` — the block that currently does `images.forEach((url, index) => { mediaDocs.push({ ... }) })`.

Responsibility: build each listing's three media documents from `galleryFor()`.

Constraints:
- Import `galleryFor` from `./demoGallery.js`.
- Replace the `mediaByReference` lookup for images with `galleryFor(property.reference, property.propertyType, property.title)`. **Leave `mediaByReference` in place if it carries anything else**; read the surrounding code before deleting.
- Each media doc keeps the existing `property`, `publicId`, `type: "image"`, `displayOrder: index` fields and gains `width`, `height` from the catalogue and `thumbnailUrl` from the catalogue's own thumbnail (not a copy of `url` — that is the current behaviour and it defeats the point of a thumbnail).
- `publicId` stays `` `demo/${property.reference}/${index + 1}` ``. It is unique-indexed and not a real Cloudinary id; leaving it recognisably `demo/` is what lets Part B's delete path tell a demo row from a real asset.
- `alt` comes from the gallery entry — do not re-derive it here, or the composed form drifts from what Task 2's test pins.
- The cover-image block that follows (`displayOrder === 0` → `Property.coverImage`) is unchanged.
- The demo JSON's `images` field is now unused. **Do not edit `nigerian_real_estate_dummy_data_200.json`** — it is source data.
- Update the block's existing comments: the `// Placeholder ids — real uploads get these from Cloudinary (§10.1).` line is still true; the surrounding narrative is not.

- [ ] **Step 4: Run the seed tests**

Run: `cd backend && npx vitest run tests/seed.test.js`
Expected: PASS, including the two new cases.

- [ ] **Step 5: Allow the CDN host in next/image**

`frontend/next.config.mjs` — add to `remotePatterns`:

```js
      { protocol: "https", hostname: "images.pexels.com" },
```

Keep `placehold.co`: `coverImageOf`'s unit tests use it, and a database seeded before this change still holds those URLs. Update the surrounding comment to name Pexels as the demo source.

- [ ] **Step 6: Credit the source**

`frontend/public/CREDITS.md` — add a row-plus-note for the demo listing photography: source `Pexels — https://www.pexels.com`, licence `Pexels Licence (free commercial use, no attribution required)`, and a line saying these are **demo images hotlinked from Pexels' CDN and must be replaced with the agency's own photography before a client launch**. Note that the catalogue is `backend/scripts/demoImages.js`, refreshed with `node scripts/fetchDemoImages.js`.

- [ ] **Step 7: Re-seed the dev database and look at it**

Run:

```bash
cd backend && node scripts/seed.js --reset --demo
cd ../frontend && npm run build
```

Expected: the seed reports 200 properties and 600 media; the Next build succeeds with no "hostname not configured" image error.

- [ ] **Step 8: Run both suites and lint**

Run: `cd backend && npm test && npm run lint`
Expected: 215/215 backend tests pass (202 baseline + 11 from Task 2 + 2 new), lint clean.

Run: `cd frontend && npm test && npm run lint`
Expected: 124/124 pass, lint clean.

- [ ] **Step 9: Commit**

```bash
git add backend/scripts/importDemoListings.js backend/tests/seed.test.js frontend/next.config.mjs frontend/public/CREDITS.md
git commit -m "feat(seed): real demo photography from the Pexels catalogue"
```

---

# Part B — Media upload

## Task 4: Cloudinary configuration and the upload signature

**Files:**
- Create: `backend/config/cloudinary.js`
- Create: `backend/utils/mediaSignature.js`
- Test: `backend/tests/mediaSignature.test.js`

**Interfaces:**
- Consumes: `cloudinary` npm package; `ApiError` from `../utils/ApiError.js`.
- Produces:
  - `backend/config/cloudinary.js`: `export default cloudinary` (the configured v2 SDK) and `export function isCloudinaryConfigured(): boolean`.
  - `backend/utils/mediaSignature.js`:
    - `export function folderForListing(reference: string): string`
    - `export function isInListingFolder(publicId: string, reference: string): boolean`
    - `export function buildUploadSignature(reference: string): { timestamp: number, signature: string, apiKey: string, cloudName: string, folder: string, uploadUrl: string, allowedFormats: string[], maxFileSize: number, eager: string }`

- [ ] **Step 1: Write the failing test**

`backend/tests/mediaSignature.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Upload signature scoping.
 *
 * A Cloudinary signature is a bearer capability: whatever it authorises, the browser
 * holding it can do. These tests pin the two things that keep it narrow — the folder
 * it is locked to, and the folder check that later rejects a publicId from anywhere
 * else. Both are pure functions, so no network and no database.
 */

const ENV = { ...process.env };

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("folderForListing", () => {
  it("gives each listing its own folder, keyed by reference", async () => {
    const { folderForListing } = await import("../utils/mediaSignature.js");

    expect(folderForListing("REF1042")).toBe("properties/REF1042");
  });

  it("refuses a reference that could escape the properties folder", async () => {
    const { folderForListing } = await import("../utils/mediaSignature.js");

    // A reference is server-generated, but path traversal in a folder name would
    // let one listing's signature write over another's assets.
    expect(() => folderForListing("../secrets")).toThrow();
    expect(() => folderForListing("REF/1042")).toThrow();
    expect(() => folderForListing("")).toThrow();
  });
});

describe("isInListingFolder", () => {
  it("accepts a publicId inside the listing's own folder", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    expect(isInListingFolder("properties/REF1042/abc123", "REF1042")).toBe(true);
  });

  it("rejects another listing's folder", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    expect(isInListingFolder("properties/REF9999/abc123", "REF1042")).toBe(false);
  });

  it("rejects a prefix that merely starts the same", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    // "properties/REF1042extra" starts with "properties/REF1042" as a string but is
    // a different folder — a naive startsWith would let it through.
    expect(isInListingFolder("properties/REF1042extra/abc", "REF1042")).toBe(false);
  });

  it("rejects a publicId outside properties/ entirely", async () => {
    const { isInListingFolder } = await import("../utils/mediaSignature.js");

    expect(isInListingFolder("REF1042/abc123", "REF1042")).toBe(false);
    expect(isInListingFolder("logos/agency-watermark", "REF1042")).toBe(false);
  });
});

describe("buildUploadSignature", () => {
  it("locks the signature to the listing's folder and a format whitelist", async () => {
    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    const result = buildUploadSignature("REF1042");

    expect(result.folder).toBe("properties/REF1042");
    expect(result.cloudName).toBe("test-cloud");
    expect(result.apiKey).toBe("test-key");
    expect(result.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload"
    );
    expect(result.allowedFormats).toEqual(["jpg", "jpeg", "png", "webp", "avif"]);
    expect(result.maxFileSize).toBeGreaterThan(0);
    expect(typeof result.signature).toBe("string");
    expect(result.signature.length).toBeGreaterThan(0);
  });

  it("never returns the API secret", async () => {
    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    // The signature goes to the browser. The secret must not travel with it.
    expect(JSON.stringify(buildUploadSignature("REF1042"))).not.toContain(
      "test-secret"
    );
  });

  it("signs different folders differently", async () => {
    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    const a = buildUploadSignature("REF1042");
    const b = buildUploadSignature("REF9999");

    // Same timestamp second, different folder — the signature must still differ, or
    // it is not actually covering the folder parameter.
    if (a.timestamp === b.timestamp) {
      expect(a.signature).not.toBe(b.signature);
    }
  });

  it("throws when Cloudinary is not configured", async () => {
    delete process.env.CLOUDINARY_API_SECRET;

    const { buildUploadSignature } = await import("../utils/mediaSignature.js");

    expect(() => buildUploadSignature("REF1042")).toThrow();
  });
});
```

Note the dynamic `await import(...)` in every case: `config/cloudinary.js` reads `process.env` at module load, and a static import would freeze the first test's environment for the whole file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/mediaSignature.test.js`
Expected: FAIL — `Failed to resolve import "../utils/mediaSignature.js"`.

- [ ] **Step 3: Write `backend/config/cloudinary.js`**

Responsibility: configure the Cloudinary v2 SDK from the environment and report whether it is usable.

Constraints:
- `import { v2 as cloudinary } from "cloudinary";` then `cloudinary.config({ cloud_name, api_key, api_secret, secure: true })`. `secure: true` matters — an `http://` delivery URL stored in the database becomes mixed content on the public site.
- `isCloudinaryConfigured()` returns true only when all three env vars are non-empty.
- **The module must not throw at import time when the vars are blank.** `app.js` imports the route tree eagerly, so a throw here takes the whole API down — the same tolerance `config/db.js` already has for a missing `MONGODB_URI`. Log a warning once instead.
- Read the env vars inside the module body (not memoised across processes) so tests can vary them per dynamic import.

- [ ] **Step 4: Write `backend/utils/mediaSignature.js`**

- `folderForListing(reference)`
  Responsibility: the Cloudinary folder a listing's assets live in.
  Constraints: returns `` `properties/${reference}` ``. Throws `ApiError(500, ...)` unless `reference` matches `/^[A-Za-z0-9-]+$/` — references are server-generated so a failure here is a bug, not user input, but the check is what stops a folder name escaping its parent.

- `isInListingFolder(publicId, reference)`
  Responsibility: decide whether a Cloudinary `public_id` belongs to this listing.
  Constraints: true only when `publicId` starts with the folder **plus a `/` separator**. `startsWith(folder)` alone matches `properties/REF1042extra/...`, which is a different listing's folder — the test pins this. Returns false rather than throwing; the caller decides the status code.

- `buildUploadSignature(reference)`
  Responsibility: produce everything the browser needs to upload directly, and nothing more.
  Constraints:
  - Throws `ApiError(503, "Image uploads are not configured")` when `isCloudinaryConfigured()` is false. The controller lets this propagate — the editor shows it inline and the rest of the form keeps working.
  - Signs exactly these params with `cloudinary.utils.api_sign_request(params, secret)`: `{ timestamp, folder, allowed_formats: "jpg,jpeg,png,webp,avif", eager: "c_fill,w_400,h_300,q_auto,f_auto" }`. Cloudinary rejects the upload if the signed set and the sent set differ, so **the browser must post exactly these and no more** — Task 8 depends on this list matching.
  - `timestamp` is `Math.round(Date.now() / 1000)`. Cloudinary rejects signatures older than roughly an hour; no extra expiry field is needed or supported.
  - Returns `apiKey` and `cloudName` (both public), never `api_secret`.
  - `maxFileSize` is `15 * 1024 * 1024` — advisory for the browser to reject early. It is **not** part of the signature: Cloudinary's `max_file_size` upload param needs an authenticated upload preset, and signing an unsupported param makes every upload fail. Server-side, the register step reads the real `bytes` back from Cloudinary.
  - `eager` produces the thumbnail. The watermark overlay is deliberately absent — see the spec's Deferred section; there is no logo asset, and pointing `watermarkedUrl` at an unwatermarked file would be worse than leaving it unset.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/mediaSignature.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/config/cloudinary.js backend/utils/mediaSignature.js backend/tests/mediaSignature.test.js
git commit -m "feat(media): cloudinary config and scoped upload signatures"
```

---

## Task 5: The signature endpoint

**Files:**
- Create: `backend/controllers/adminMediaController.js`
- Create: `backend/routes/adminMediaRoutes.js`
- Modify: `backend/routes/adminPropertyRoutes.js`
- Test: `backend/tests/api.adminMedia.test.js`

**Interfaces:**
- Consumes: `buildUploadSignature`, `folderForListing`, `isInListingFolder` (Task 4); `requireAuth`, `canManageProperty` from `../middleware/auth.js`; `strictLimiter` from `../middleware/rateLimiter.js`.
- Produces:
  - `export async function createUploadSignature(req, res)`
  - `export async function loadManageableProperty(id, user)` — shared helper, used by every handler in Tasks 5-7. Returns the `Property` document; throws `ApiError(404)` when missing, `ApiError(403)` when the caller may not manage it.
  - Route: `POST /api/admin/properties/:id/media/signature` → `201`? No — **`200`** with `{ success: true, data: { ...signature } }`.

**Mounting:** `adminMediaRoutes.js` is a `Router({ mergeParams: true })` mounted inside `adminPropertyRoutes.js` as `router.use("/:id/media", adminMediaRoutes)`. `mergeParams` is what makes `req.params.id` visible; without it every handler reads `undefined`. Mount it **before** `router.get("/:id", ...)` is irrelevant (different path depth) but **after** `router.use(requireAuth)` so the session check still covers it.

- [ ] **Step 1: Write the failing test**

`backend/tests/api.adminMedia.test.js` — the file grows through Tasks 5-7; write this much now:

```js
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";

/**
 * Admin media endpoints.
 *
 * Cloudinary is mocked throughout: these tests are about who may upload where and
 * what the API is willing to believe from the client, not about the SDK. The
 * important cases are the ones where trusting the request body would let a caller
 * attach an asset that is not theirs.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";

const app = createApp();

/**
 * Logs in and returns the session cookie.
 *
 * Takes: email (string), password (string).
 * Returns: a promise resolving to the Set-Cookie value for subsequent requests.
 */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("POST /api/admin/properties/:id/media/signature", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    location = await Location.findOne({ state: "Lagos" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
      canPublish: false,
    });

    otherAgent = await Agent.create({
      name: "Other Agent",
      slug: "other-agent",
      email: "other@example.com",
      password: "agent-password",
      role: "agent",
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  /** Minimum valid listing payload. */
  const listingBody = () => ({
    title: "3 Bedroom Flat in Lekki",
    listingType: "sale",
    propertyType: "apartment",
    location: String(location._id),
    landmark: "Opposite Circle Mall",
    price: { amount: 95000000, currency: "NGN" },
  });

  /**
   * Creates a listing through the API and returns the raw record.
   *
   * Takes: cookie (string), overrides (object) merged into the body.
   * Returns: a promise resolving to the created property JSON.
   */
  async function createListing(cookie, overrides = {}) {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", cookie)
      .send({ ...listingBody(), ...overrides });

    return response.body.data.property;
  }

  it("requires a session", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app).post(
      `/api/admin/properties/${property._id}/media/signature`
    );

    expect(response.status).toBe(401);
  });

  it("returns a signature scoped to the listing's own folder", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media/signature`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.folder).toBe(`properties/${property.reference}`);
    expect(response.body.data.uploadUrl).toContain("/v1_1/test-cloud/image/upload");
    expect(response.body.data.signature).toBeTruthy();
    expect(response.body.data.apiKey).toBe("test-key");
  });

  it("never leaks the API secret to the browser", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media/signature`)
      .set("Cookie", adminCookie);

    expect(JSON.stringify(response.body)).not.toContain("test-secret");
  });

  it("refuses a listing the agent does not own, with 403 not 404", async () => {
    const property = await createListing(adminCookie, { agent: String(otherAgent._id) });

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media/signature`)
      .set("Cookie", agentCookie);

    // 403, not 404: these are authenticated colleagues, and pretending the record
    // does not exist is the public surface's rule, not this one's.
    expect(response.status).toBe(403);
  });

  it("404s for a listing that does not exist", async () => {
    const response = await request(app)
      .post("/api/admin/properties/64b7f0000000000000000000/media/signature")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });

  it("503s when Cloudinary is not configured, without taking the API down", async () => {
    const property = await createListing(adminCookie);
    const secret = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;

    try {
      const response = await request(app)
        .post(`/api/admin/properties/${property._id}/media/signature`)
        .set("Cookie", adminCookie);

      expect(response.status).toBe(503);

      // The rest of the admin surface is unaffected — an unconfigured Cloudinary
      // must not stop anyone editing a listing.
      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);
      expect(listing.status).toBe(200);
    } finally {
      process.env.CLOUDINARY_API_SECRET = secret;
    }
  });
});
```

Note: the 503 case requires `buildUploadSignature` to read `process.env` at **call** time, not at module load. If Task 4's implementation memoised the config at import, fix it there rather than weakening this test — a deploy that adds the env var without a restart should start working.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.adminMedia.test.js`
Expected: FAIL — every request 404s, because no media route is mounted.

- [ ] **Step 3: Write the controller's shared helper and the signature handler**

`backend/controllers/adminMediaController.js`

- `loadManageableProperty(id, user)`
  Responsibility: fetch a listing and assert the caller may manage it.
  Constraints:
  - `Property.findById(id)`; throw `ApiError(404, "Listing not found")` when absent **or when the id is not a valid ObjectId** — a `CastError` would otherwise surface as 400 and read as a validation failure.
  - Throw `ApiError(403, "You can only manage your own listings")` when `canManageProperty(user, property)` is false. Reuse that helper; do not re-implement the role check.
  - Soft-deleted listings (`deletedAt` set) are still manageable — media on a restorable listing must not become unreachable.

- `createUploadSignature(req, res)`
  Responsibility: issue a scoped upload signature.
  Constraints: load the property through `loadManageableProperty`, then `res.status(200).json({ success: true, data: buildUploadSignature(property.reference) })`. Let the 503 from `buildUploadSignature` propagate — Express 5 forwards it.

- [ ] **Step 4: Write the router and mount it**

`backend/routes/adminMediaRoutes.js`

Constraints:
- `Router({ mergeParams: true })` — without it `req.params.id` is `undefined` and every handler 404s.
- `router.post("/signature", strictLimiter, createUploadSignature)` — `strictLimiter`, not just the global `apiLimiter`, because every signature authorises spend against the Cloudinary account. This is the same rule the AI search and lead endpoints follow.

`backend/routes/adminPropertyRoutes.js` — add `router.use("/:id/media", adminMediaRoutes);` after the existing `router.use(requireAuth)` and alongside the other `/:id` routes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.adminMedia.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/adminMediaController.js backend/routes/adminMediaRoutes.js backend/routes/adminPropertyRoutes.js backend/tests/api.adminMedia.test.js
git commit -m "feat(media): scoped upload signature endpoint"
```

---

## Task 6: Registering an uploaded asset

**Files:**
- Modify: `backend/controllers/adminMediaController.js`
- Modify: `backend/routes/adminMediaRoutes.js`
- Test: `backend/tests/api.adminMedia.test.js` (extend)

**Interfaces:**
- Consumes: `loadManageableProperty` (Task 5); `isInListingFolder` (Task 4); `cloudinary` default export from `../config/cloudinary.js`.
- Produces: `export async function registerMedia(req, res)`; route `POST /api/admin/properties/:id/media` → `201` with `{ success: true, data: { media } }`.

**This is the security hinge of the whole feature.** The browser uploaded directly, so the API never saw the bytes. The only thing the client sends is a `publicId`, and everything else is read back from Cloudinary.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/api.adminMedia.test.js`. Mock the SDK at the top of the file (module-level, above `const app = createApp()`):

```js
// Cloudinary is mocked for the whole file: the API's job is to decide what to
// believe about an asset, and a real upload would test Cloudinary, not us.
const cloudinaryMock = vi.hoisted(() => ({
  api: { resource: vi.fn() },
  uploader: { destroy: vi.fn() },
}));

vi.mock("../config/cloudinary.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: cloudinaryMock,
  };
});
```

Then the new describe block:

```js
describe("POST /api/admin/properties/:id/media", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    location = await Location.findOne({ state: "Lagos" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
      canPublish: false,
    });

    otherAgent = await Agent.create({
      name: "Other Agent",
      slug: "other-agent",
      email: "other@example.com",
      password: "agent-password",
      role: "agent",
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  const listingBody = () => ({
    title: "3 Bedroom Flat in Lekki",
    listingType: "sale",
    propertyType: "apartment",
    location: String(location._id),
    landmark: "Opposite Circle Mall",
    price: { amount: 95000000, currency: "NGN" },
  });

  async function createListing(cookie, overrides = {}) {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", cookie)
      .send({ ...listingBody(), ...overrides });

    return response.body.data.property;
  }

  /** The shape Cloudinary's Admin API returns for one image. */
  function cloudinaryResource(publicId) {
    return {
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.jpg`,
      width: 4032,
      height: 3024,
      bytes: 2_400_000,
      format: "jpg",
      resource_type: "image",
      eager: [
        {
          secure_url: `https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_400,h_300/${publicId}.jpg`,
        },
      ],
    };
  }

  it("registers an asset that sits in the listing's folder", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId, alt: "Front elevation" });

    expect(response.status).toBe(201);
    expect(response.body.data.media.publicId).toBe(publicId);
    expect(response.body.data.media.alt).toBe("Front elevation");
    expect(response.body.data.media.width).toBe(4032);
    expect(response.body.data.media.height).toBe(3024);
    expect(response.body.data.media.thumbnailUrl).toContain("c_fill,w_400,h_300");
    expect(response.body.data.media.displayOrder).toBe(0);
  });

  it("takes url and dimensions from Cloudinary, never from the request body", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({
        publicId,
        // All three are attacker-controlled if believed: a foreign url makes the
        // record point anywhere, and false dimensions poison the layout-shift
        // reservation on every page the image appears on.
        url: "https://evil.example.com/tracker.gif",
        width: 1,
        height: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.media.url).toContain("res.cloudinary.com");
    expect(response.body.data.media.url).not.toContain("evil.example.com");
    expect(response.body.data.media.width).toBe(4032);
    expect(response.body.data.media.height).toBe(3024);
  });

  it("rejects a publicId belonging to another listing", async () => {
    const property = await createListing(adminCookie);
    const foreign = "properties/REF9999/stolen";
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(foreign));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId: foreign });

    expect(response.status).toBe(400);
    // The folder check must run before the lookup, so a probe cannot be used to
    // discover which public ids exist in the account.
    expect(cloudinaryMock.api.resource).not.toHaveBeenCalled();
  });

  it("rejects a publicId outside the properties folder entirely", async () => {
    const property = await createListing(adminCookie);

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId: "logos/agency-watermark" });

    expect(response.status).toBe(400);
  });

  it("404s when Cloudinary has no such asset", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/missing`;
    cloudinaryMock.api.resource.mockRejectedValue({ http_code: 404 });

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    expect(response.status).toBe(404);
  });

  it("appends to the end of the gallery", async () => {
    const property = await createListing(adminCookie);

    for (const name of ["first", "second"]) {
      const publicId = `properties/${property.reference}/${name}`;
      cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));
      await request(app)
        .post(`/api/admin/properties/${property._id}/media`)
        .set("Cookie", adminCookie)
        .send({ publicId });
    }

    const listing = await request(app)
      .get(`/api/admin/properties/${property._id}`)
      .set("Cookie", adminCookie);

    expect(listing.body.data.media.map((item) => item.displayOrder)).toEqual([0, 1]);
  });

  it("rejects registering the same asset twice", async () => {
    const property = await createListing(adminCookie);
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    const second = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", adminCookie)
      .send({ publicId });

    // publicId is unique-indexed; the error handler already maps 11000 to 409.
    expect(second.status).toBe(409);
  });

  it("refuses a listing the agent does not own", async () => {
    const property = await createListing(adminCookie, { agent: String(otherAgent._id) });
    const publicId = `properties/${property.reference}/abc123`;
    cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

    const response = await request(app)
      .post(`/api/admin/properties/${property._id}/media`)
      .set("Cookie", agentCookie)
      .send({ publicId });

    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.adminMedia.test.js`
Expected: FAIL — the new block 404s; the Task 5 block still passes.

- [ ] **Step 3: Write `registerMedia`**

`backend/controllers/adminMediaController.js` — add:

- `registerMedia(req, res)`
  Responsibility: turn a `publicId` the browser uploaded into a `PropertyMedia` record.
  Constraints, **in this order** — the order is asserted by a test:
  1. `loadManageableProperty(req.params.id, req.user)`.
  2. Require a non-empty string `publicId` in the body; `ApiError(400, "publicId is required")`.
  3. `isInListingFolder(publicId, property.reference)` → `ApiError(400, "That image does not belong to this listing")`. **Before** any Cloudinary call: calling first would turn the endpoint into an oracle for which public ids exist in the account.
  4. `await cloudinary.api.resource(publicId, { resource_type: "image" })`. Catch and rethrow: `http_code === 404` → `ApiError(404, "That image was not found")`; anything else → `ApiError(502, "Could not verify the upload with Cloudinary")`. Never let a raw SDK error reach the client — it carries account detail.
  5. Build the record **entirely from the SDK response**: `url` from `secure_url`, `width`, `height`, `bytes`, and `thumbnailUrl` from `resource.eager?.[0]?.secure_url` falling back to `secure_url`. Ignore any `url`/`width`/`height`/`bytes`/`thumbnailUrl` in the request body. The only body fields honoured are `publicId` and `alt`.
  6. `displayOrder` is `(max existing displayOrder for this property) + 1`, or `0` when the gallery is empty. Compute it server-side with a single sorted query — never accept it from the body.
  7. `type: "image"`. Video is out of scope for this slice.
  8. `res.status(201).json({ success: true, data: { media } })`.
  - Duplicate `publicId` hits the unique index; the existing error handler already maps 11000 to 409. Do not pre-check and do not catch it.

- [ ] **Step 4: Add the route**

`backend/routes/adminMediaRoutes.js` — `router.post("/", registerMedia);`

No `strictLimiter` here: the spend already happened at the signature step, and a retry after a dropped connection must not be throttled into failing.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.adminMedia.test.js`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/adminMediaController.js backend/routes/adminMediaRoutes.js backend/tests/api.adminMedia.test.js
git commit -m "feat(media): register uploaded assets against verified cloudinary metadata"
```

---

## Task 7: Reorder, alt text, and delete

**Files:**
- Modify: `backend/controllers/adminMediaController.js`
- Modify: `backend/routes/adminMediaRoutes.js`
- Test: `backend/tests/api.adminMedia.test.js` (extend)

**Interfaces:**
- Consumes: `loadManageableProperty` (Task 5); `cloudinary` (Task 4).
- Produces:
  - `export async function reorderMedia(req, res)` — `PATCH /media/order`, body `{ ids: string[] }`, `200` with `{ success: true, data: { media } }` (the reordered gallery).
  - `export async function updateMedia(req, res)` — `PATCH /media/:mediaId`, body `{ alt }`, `200` with `{ success: true, data: { media } }`.
  - `export async function deleteMedia(req, res)` — `DELETE /media/:mediaId`, `200` with `{ success: true, data: { deleted: true } }`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/api.adminMedia.test.js`. Reuse the same `beforeEach` setup, `createListing` and `cloudinaryResource` helpers (restate them in the new describe block — do not hoist them into shared module scope, the existing admin suites keep each block self-contained):

```js
describe("gallery management", () => {
  let adminCookie;
  let agentCookie;
  let location;
  let otherAgent;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    location = await Location.findOne({ state: "Lagos" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
    });

    otherAgent = await Agent.create({
      name: "Other Agent",
      slug: "other-agent",
      email: "other@example.com",
      password: "agent-password",
      role: "agent",
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  const listingBody = () => ({
    title: "3 Bedroom Flat in Lekki",
    listingType: "sale",
    propertyType: "apartment",
    location: String(location._id),
    landmark: "Opposite Circle Mall",
    price: { amount: 95000000, currency: "NGN" },
  });

  async function createListing(cookie, overrides = {}) {
    const response = await request(app)
      .post("/api/admin/properties")
      .set("Cookie", cookie)
      .send({ ...listingBody(), ...overrides });

    return response.body.data.property;
  }

  function cloudinaryResource(publicId) {
    return {
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.jpg`,
      width: 4032,
      height: 3024,
      bytes: 2_400_000,
      format: "jpg",
      resource_type: "image",
      eager: [
        {
          secure_url: `https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_400,h_300/${publicId}.jpg`,
        },
      ],
    };
  }

  /**
   * Creates a listing with `count` registered images.
   *
   * Takes: cookie (string), count (number), overrides (object).
   * Returns: a promise resolving to { property, media } — media in display order.
   */
  async function listingWithMedia(cookie, count = 3, overrides = {}) {
    const property = await createListing(cookie, overrides);
    const media = [];

    for (let index = 0; index < count; index += 1) {
      const publicId = `properties/${property.reference}/image-${index}`;
      cloudinaryMock.api.resource.mockResolvedValue(cloudinaryResource(publicId));

      const response = await request(app)
        .post(`/api/admin/properties/${property._id}/media`)
        .set("Cookie", cookie)
        .send({ publicId });

      media.push(response.body.data.media);
    }

    return { property, media };
  }

  describe("PATCH /media/order", () => {
    it("rewrites displayOrder to match the submitted order", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 3);
      const reversed = [media[2]._id, media[1]._id, media[0]._id];

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: reversed });

      expect(response.status).toBe(200);
      expect(response.body.data.media.map((item) => String(item._id))).toEqual(
        reversed.map(String)
      );
      expect(response.body.data.media.map((item) => item.displayOrder)).toEqual([
        0, 1, 2,
      ]);
    });

    it("rejects a partial list", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 3);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: [media[0]._id, media[1]._id] });

      // A partial list would leave the omitted image with a stale displayOrder,
      // silently colliding with one of the rewritten ones.
      expect(response.status).toBe(400);
    });

    it("rejects an id belonging to another listing", async () => {
      const mine = await listingWithMedia(adminCookie, 2);
      const theirs = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(`/api/admin/properties/${mine.property._id}/media/order`)
        .set("Cookie", adminCookie)
        .send({ ids: [mine.media[0]._id, theirs.media[0]._id] });

      expect(response.status).toBe(400);
    });

    it("refuses a listing the agent does not own", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2, {
        agent: String(otherAgent._id),
      });

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/order`)
        .set("Cookie", agentCookie)
        .send({ ids: [media[1]._id, media[0]._id] });

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /media/:mediaId", () => {
    it("updates alt text", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie)
        .send({ alt: "Rear garden at dusk" });

      expect(response.status).toBe(200);
      expect(response.body.data.media.alt).toBe("Rear garden at dusk");
    });

    it("ignores every field but alt", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie)
        .send({
          alt: "Rear garden",
          url: "https://evil.example.com/tracker.gif",
          publicId: "properties/REF9999/stolen",
          displayOrder: 99,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.media.url).toContain("res.cloudinary.com");
      expect(response.body.data.media.publicId).toBe(media[0].publicId);
      expect(response.body.data.media.displayOrder).toBe(0);
    });

    it("404s for an image on another listing", async () => {
      const mine = await listingWithMedia(adminCookie, 1);
      const theirs = await listingWithMedia(adminCookie, 1);

      const response = await request(app)
        .patch(
          `/api/admin/properties/${mine.property._id}/media/${theirs.media[0]._id}`
        )
        .set("Cookie", adminCookie)
        .send({ alt: "Not mine" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /media/:mediaId", () => {
    it("destroys the Cloudinary asset before dropping the record", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "ok" });

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[1]._id}`)
        .set("Cookie", adminCookie);

      expect(response.status).toBe(200);
      // An orphaned Cloudinary asset bills forever and nothing points at it; an
      // orphaned database row is visible and fixable. So the remote goes first.
      expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(
        media[1].publicId,
        expect.anything()
      );

      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);
      expect(listing.body.data.media).toHaveLength(1);
    });

    it("clears the listing's cover when the deleted image was it", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "ok" });

      await request(app)
        .patch(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie)
        .send({ coverImage: media[0]._id });

      await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie);

      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);

      // A dangling cover reference makes coverImageOf fall through to the grey
      // placeholder with nothing in the UI explaining why.
      expect(listing.body.data.property.coverImage ?? null).toBeNull();
    });

    it("leaves the cover alone when a different image is deleted", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 2);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "ok" });

      await request(app)
        .patch(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie)
        .send({ coverImage: media[0]._id });

      await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[1]._id}`)
        .set("Cookie", adminCookie);

      const listing = await request(app)
        .get(`/api/admin/properties/${property._id}`)
        .set("Cookie", adminCookie);

      expect(String(listing.body.data.property.coverImage._id)).toBe(
        String(media[0]._id)
      );
    });

    it("still removes the record when Cloudinary reports the asset already gone", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1);
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: "not found" });

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", adminCookie);

      // Otherwise a half-deleted asset is permanently undeletable from the UI.
      expect(response.status).toBe(200);
    });

    it("refuses a listing the agent does not own", async () => {
      const { property, media } = await listingWithMedia(adminCookie, 1, {
        agent: String(otherAgent._id),
      });

      const response = await request(app)
        .delete(`/api/admin/properties/${property._id}/media/${media[0]._id}`)
        .set("Cookie", agentCookie);

      expect(response.status).toBe(403);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run tests/api.adminMedia.test.js`
Expected: FAIL — the `gallery management` block 404s; Tasks 5 and 6 still pass.

- [ ] **Step 3: Write the three handlers**

`backend/controllers/adminMediaController.js` — add:

- `reorderMedia(req, res)`
  Responsibility: rewrite `displayOrder` across a listing's gallery to match a submitted order.
  Constraints:
  - Body `ids` must be an array of strings; otherwise `ApiError(400, "ids must be an array of media ids")`.
  - Load the listing's current media ids. The submitted array must be a **permutation** — same length, same set, no duplicates. Anything else is `ApiError(400, ...)`. A partial array is the dangerous case: the omitted rows keep stale `displayOrder` values that collide with the rewritten ones, and the gallery order becomes arbitrary.
  - Write with a single `PropertyMedia.bulkWrite()` of `updateOne` operations, index → `displayOrder`. Not 20 sequential `save()` calls.
  - Respond with the reloaded gallery sorted by `displayOrder`, so the client re-renders from the server's truth rather than its own optimistic guess.

- `updateMedia(req, res)`
  Responsibility: edit an image's alt text.
  Constraints:
  - Find by `{ _id: req.params.mediaId, property: property._id }` — scoping the query by the listing is what makes a foreign `mediaId` a 404 rather than an edit. `ApiError(404, "Image not found")` when absent.
  - **Only `alt` is writable.** Assign it explicitly; never spread `req.body`. `url`, `publicId`, `displayOrder`, `width` and `height` are all server-controlled, exactly as `WRITABLE_FIELDS` works in `adminPropertyController.js`.
  - Trim, and allow clearing to an empty string.

- `deleteMedia(req, res)`
  Responsibility: remove an image from the listing and from Cloudinary.
  Constraints:
  - Same listing-scoped lookup as `updateMedia`.
  - `await cloudinary.uploader.destroy(media.publicId, { resource_type: "image", invalidate: true })` **first**. `invalidate: true` purges the CDN cache; without it the deleted photo keeps being served from edge caches.
  - Treat `result: "not found"` as success. An asset already gone is the outcome we wanted; failing here would make a half-deleted image permanently undeletable from the UI.
  - A genuine SDK failure (network, auth) → `ApiError(502, "Could not delete the image from Cloudinary")`, and **the record stays**. Deleting the row first would orphan a billable asset with nothing left pointing at it.
  - After deleting the record, clear `Property.coverImage` when it equalled this media id — use a scoped `Property.updateOne({ _id, coverImage: mediaId }, { $unset: { coverImage: "" } })` so a concurrent cover change is not clobbered.
  - Remaining `displayOrder` values are **not** renumbered. They stay strictly increasing, which is all the sort needs, and renumbering would race with a concurrent reorder.
  - Respond `200` with `{ success: true, data: { deleted: true } }`.

- [ ] **Step 4: Add the routes**

`backend/routes/adminMediaRoutes.js`:

```js
router.patch("/order", reorderMedia);
router.patch("/:mediaId", updateMedia);
router.delete("/:mediaId", deleteMedia);
```

`"/order"` **must** be declared before `"/:mediaId"` — the parameterised route would otherwise swallow it and try to update a media document with the id `"order"`. This is the same ordering rule as `/properties/featured` before `/:slug` and `/enquiries/stats` before `/:id`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/api.adminMedia.test.js`
Expected: PASS, 26 tests.

- [ ] **Step 6: Run the full backend suite and lint**

Run: `cd backend && npm test && npm run lint`
Expected: 252/252 pass (215 after Task 3 + 11 signature-util + 26 API), lint clean.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/adminMediaController.js backend/routes/adminMediaRoutes.js backend/tests/api.adminMedia.test.js
git commit -m "feat(media): gallery reorder, alt text and delete"
```

---

## Task 8: Browser upload client

**Files:**
- Modify: `frontend/src/lib/api/admin.js`
- Create: `frontend/src/lib/uploadMedia.js`
- Test: `frontend/src/lib/uploadMedia.test.js`

**Interfaces:**
- Consumes: `apiClient` from `@/lib/api/client`.
- Produces, in `admin.js`:
  - `export async function createUploadSignature(propertyId): Promise<signature>`
  - `export async function registerMedia(propertyId, body): Promise<media>` — `body` is `{ publicId, alt? }`
  - `export async function reorderMedia(propertyId, ids): Promise<media[]>`
  - `export async function updateMedia(propertyId, mediaId, body): Promise<media>`
  - `export async function deleteMedia(propertyId, mediaId): Promise<void>`
- Produces, in `uploadMedia.js`:
  - `export function uploadPropertyImage(propertyId, file, { onProgress, signal }): Promise<media>`
  - `export const MAX_UPLOAD_BYTES: number`
  - `export const ACCEPTED_TYPES: string[]`

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/uploadMedia.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { uploadPropertyImage, MAX_UPLOAD_BYTES } from "./uploadMedia";
import * as admin from "./api/admin";

/**
 * The browser half of the upload.
 *
 * The order of operations is the whole point: a registration call that happens
 * before Cloudinary confirms, or after a failure, writes a database row pointing at
 * an asset that does not exist. XMLHttpRequest is stubbed because jsdom has no real
 * one and the upload never leaves the test.
 */

/** Minimal XHR double capturing what was sent and letting the test resolve it. */
class MockXHR {
  static instances = [];

  constructor() {
    this.upload = { onprogress: null };
    this.readyState = 0;
    this.status = 0;
    this.responseText = "";
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.headers = {};
    MockXHR.instances.push(this);
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key, value) {
    this.headers[key] = value;
  }

  send(body) {
    this.body = body;
  }

  abort() {
    this.onabort?.();
  }

  /** Test helper: finish the request with a Cloudinary-shaped response. */
  succeed(payload) {
    this.status = 200;
    this.responseText = JSON.stringify(payload);
    this.onload?.();
  }

  /** Test helper: finish the request as a failure. */
  fail(status = 500) {
    this.status = status;
    this.responseText = JSON.stringify({ error: { message: "nope" } });
    this.onload?.();
  }
}

const signature = {
  timestamp: 1_700_000_000,
  signature: "sig-abc",
  apiKey: "test-key",
  cloudName: "test-cloud",
  folder: "properties/REF1042",
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
  maxFileSize: 15 * 1024 * 1024,
  eager: "c_fill,w_400,h_300,q_auto,f_auto",
};

/** A File the size of `bytes`, without allocating that much memory. */
function fakeFile(name = "house.jpg", type = "image/jpeg", bytes = 1024) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

beforeEach(() => {
  MockXHR.instances = [];
  vi.stubGlobal("XMLHttpRequest", MockXHR);
  vi.spyOn(admin, "createUploadSignature").mockResolvedValue(signature);
  vi.spyOn(admin, "registerMedia").mockResolvedValue({
    _id: "m1",
    url: "https://res.cloudinary.com/test-cloud/image/upload/x.jpg",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("uploadPropertyImage", () => {
  it("requests a signature, uploads to Cloudinary, then registers the result", async () => {
    const promise = uploadPropertyImage("p1", fakeFile());

    // Let the signature request settle before the XHR exists.
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    const [xhr] = MockXHR.instances;
    expect(xhr.url).toBe(signature.uploadUrl);
    expect(admin.registerMedia).not.toHaveBeenCalled();

    xhr.succeed({ public_id: "properties/REF1042/abc123" });
    await promise;

    // The API is told only the public id — it re-reads everything else from
    // Cloudinary, so sending more would be pointless and misleading.
    expect(admin.registerMedia).toHaveBeenCalledWith("p1", {
      publicId: "properties/REF1042/abc123",
    });
  });

  it("sends exactly the signed parameters", async () => {
    const promise = uploadPropertyImage("p1", fakeFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    const [xhr] = MockXHR.instances;
    const sent = Object.fromEntries(xhr.body.entries());

    // Cloudinary recomputes the signature over the params it receives. One extra
    // or missing field and every upload fails with "Invalid Signature".
    expect(Object.keys(sent).sort()).toEqual(
      ["allowed_formats", "api_key", "eager", "file", "folder", "signature", "timestamp"].sort()
    );
    expect(sent.folder).toBe(signature.folder);
    expect(sent.signature).toBe(signature.signature);

    xhr.succeed({ public_id: "properties/REF1042/abc123" });
    await promise;
  });

  it("reports progress", async () => {
    const onProgress = vi.fn();
    const promise = uploadPropertyImage("p1", fakeFile(), { onProgress });
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    const [xhr] = MockXHR.instances;
    xhr.upload.onprogress({ lengthComputable: true, loaded: 50, total: 200 });

    expect(onProgress).toHaveBeenCalledWith(25);

    xhr.succeed({ public_id: "properties/REF1042/abc123" });
    await promise;
  });

  it("does not register anything when the upload fails", async () => {
    const promise = uploadPropertyImage("p1", fakeFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    MockXHR.instances[0].fail(500);

    await expect(promise).rejects.toThrow();
    // A row pointing at an asset that was never stored is worse than no row.
    expect(admin.registerMedia).not.toHaveBeenCalled();
  });

  it("rejects a file that is too large before asking for a signature", async () => {
    await expect(
      uploadPropertyImage("p1", fakeFile("huge.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1))
    ).rejects.toThrow(/too large/i);

    // Requesting a signature costs a rate-limited call; a doomed upload must not
    // spend one.
    expect(admin.createUploadSignature).not.toHaveBeenCalled();
  });

  it("rejects a file type Cloudinary would refuse", async () => {
    await expect(
      uploadPropertyImage("p1", fakeFile("plan.pdf", "application/pdf"))
    ).rejects.toThrow(/jpg|png|webp|image/i);

    expect(admin.createUploadSignature).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/uploadMedia.test.js`
Expected: FAIL — `Failed to resolve import "./uploadMedia"`.

- [ ] **Step 3: Add the API wrappers**

`frontend/src/lib/api/admin.js` — append five wrappers matching the file's existing shape (a block comment, `apiClient`, return the unwrapped `data`):

- `createUploadSignature(propertyId)` → `POST /admin/properties/${propertyId}/media/signature`, returns `data.data`.
- `registerMedia(propertyId, body)` → `POST /admin/properties/${propertyId}/media`, returns `data.data.media`.
- `reorderMedia(propertyId, ids)` → `PATCH /admin/properties/${propertyId}/media/order` with `{ ids }`, returns `data.data.media`.
- `updateMedia(propertyId, mediaId, body)` → `PATCH /admin/properties/${propertyId}/media/${mediaId}`, returns `data.data.media`.
- `deleteMedia(propertyId, mediaId)` → `DELETE /admin/properties/${propertyId}/media/${mediaId}`, returns nothing.

- [ ] **Step 4: Write `frontend/src/lib/uploadMedia.js`**

Responsibility: take a `File` from the browser to a registered `PropertyMedia` record.

Constraints:
- `MAX_UPLOAD_BYTES = 15 * 1024 * 1024`; `ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"]`.
- **Validate size and type before requesting a signature.** The signature endpoint is `strictLimiter`-throttled; spending a call on an upload that cannot succeed is wasteful and eats the user's budget for real ones. Throw an `Error` whose message names the actual limit, since it goes straight into the UI.
- The upload uses `XMLHttpRequest`, not `fetch`. `fetch` has no request-progress event, and an 8MB photo on a slow connection with no progress bar looks frozen.
- The `FormData` must carry **exactly**: `file`, `api_key`, `timestamp`, `signature`, `folder`, `allowed_formats`, `eager` — matching Task 4's signed set. Cloudinary recomputes the signature over what it receives, so one extra field fails every upload with "Invalid Signature". Do not add `alt`, `context`, `tags` or `public_id` without adding them to `buildUploadSignature` too.
- `onProgress` receives an integer percentage 0-100, only when `event.lengthComputable`.
- On `xhr.onload`, treat `status >= 200 && status < 300` as success and parse `responseText`; anything else rejects with Cloudinary's `error.message` when present. `onerror` and `onabort` reject too.
- **Register only after Cloudinary confirms.** Call `registerMedia(propertyId, { publicId: response.public_id })` — the public id and nothing else; the API reads the rest back from Cloudinary and ignores anything more we send.
- `signal` (an `AbortSignal`) calls `xhr.abort()`.
- **Chunking:** files over 20MB would need `Content-Range` plus a shared `X-Unique-Upload-Id` header across sequential slices. `MAX_UPLOAD_BYTES` is 15MB, below Cloudinary's 20MB unchunked limit for free accounts, so **no chunking path is implemented** — a branch that never runs is a branch that is never right. If the limit is ever raised past 20MB, that is when chunking gets written and tested. Leave a comment saying exactly this.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/uploadMedia.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api/admin.js frontend/src/lib/uploadMedia.js frontend/src/lib/uploadMedia.test.js
git commit -m "feat(admin): browser upload client for property images"
```

> **Deviation from the spec:** the spec described a chunked path for files over 20MB. Implementation caps uploads at 15MB instead, which removes the need for it. Record this in the spec's Deferred section as part of Task 10.

---

## Task 9: The gallery manager

**Files:**
- Create: `frontend/src/components/admin/MediaManager.jsx`
- Modify: `frontend/src/components/admin/property/MediaSection.jsx`
- Modify: `frontend/src/components/admin/PropertyForm.jsx` (pass `propertyId` and `onMediaChange` down)
- Modify: `frontend/src/components/admin/PropertyForm.test.jsx` (assertions that depend on the old picker's copy)
- Modify: `frontend/src/app/admin/(panel)/properties/[id]/page.js` (nothing, if `onSaved` already refetches — verify)
- Delete: `frontend/src/components/admin/CoverImagePicker.jsx`
- Test: `frontend/src/components/admin/MediaManager.test.jsx`

**Interfaces:**
- Consumes: `uploadPropertyImage`, `MAX_UPLOAD_BYTES`, `ACCEPTED_TYPES` (Task 8); `reorderMedia`, `updateMedia`, `deleteMedia` from `@/lib/api/admin`; `ConfirmDialog` from `@/components/admin/ConfirmDialog`.
- Produces: `MediaManager({ propertyId, media, value, onChange, onMediaChange })` — `value`/`onChange` are the cover-image field from react-hook-form's `Controller`; `onMediaChange` is called after any successful mutation so the editor refetches.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/admin/MediaManager.test.jsx`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MediaManager from "./MediaManager";
import * as admin from "@/lib/api/admin";

/**
 * The listing gallery.
 *
 * The behaviours worth pinning are the ones a wrong guess makes destructive or
 * confusing: deleting without confirmation, offering upload on a listing that has no
 * id yet, and reordering with a mouse only.
 */

const media = [
  {
    _id: "m1",
    url: "https://res.cloudinary.com/x/a.jpg",
    thumbnailUrl: "https://res.cloudinary.com/x/a-thumb.jpg",
    alt: "Front elevation",
    displayOrder: 0,
  },
  {
    _id: "m2",
    url: "https://res.cloudinary.com/x/b.jpg",
    thumbnailUrl: "https://res.cloudinary.com/x/b-thumb.jpg",
    alt: "Living room",
    displayOrder: 1,
  },
];

beforeEach(() => {
  vi.spyOn(admin, "reorderMedia").mockResolvedValue(media);
  vi.spyOn(admin, "deleteMedia").mockResolvedValue(undefined);
  vi.spyOn(admin, "updateMedia").mockResolvedValue(media[0]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MediaManager", () => {
  it("tells the user to save first when there is no listing yet", () => {
    render(<MediaManager propertyId={null} media={[]} value="" onChange={() => {}} />);

    // Uploading before the listing exists means no folder and no ownership check,
    // so the assets would be orphaned by an abandoned draft.
    expect(screen.getByText(/save the listing first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/add photos/i)).not.toBeInTheDocument();
  });

  it("offers a drop zone once the listing exists", () => {
    render(<MediaManager propertyId="p1" media={[]} value="" onChange={() => {}} />);

    expect(screen.getByLabelText(/add photos/i)).toBeInTheDocument();
  });

  it("renders every image with its alt text", () => {
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    expect(screen.getByDisplayValue("Front elevation")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Living room")).toBeInTheDocument();
  });

  it("marks the chosen cover and reports a change", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MediaManager propertyId="p1" media={media} value="m1" onChange={onChange} />
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked();

    await user.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith("m2");
  });

  it("reorders from the keyboard, not just by dragging", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    // Drag-and-drop alone would make gallery order unreachable for anyone not using
    // a mouse.
    await user.click(screen.getAllByRole("button", { name: /move .* later/i })[0]);

    await waitFor(() =>
      expect(admin.reorderMedia).toHaveBeenCalledWith("p1", ["m2", "m1"])
    );
  });

  it("confirms before deleting", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    await user.click(screen.getAllByRole("button", { name: /remove/i })[0]);

    // Deleting an image destroys the Cloudinary asset — it is not undoable the way
    // a soft-deleted listing is.
    expect(admin.deleteMedia).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^remove$|^delete$/i }));

    await waitFor(() => expect(admin.deleteMedia).toHaveBeenCalledWith("p1", "m1"));
  });

  it("saves alt text on blur", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    const input = screen.getByDisplayValue("Front elevation");
    await user.clear(input);
    await user.type(input, "Front of the house");
    await user.tab();

    await waitFor(() =>
      expect(admin.updateMedia).toHaveBeenCalledWith("p1", "m1", {
        alt: "Front of the house",
      })
    );
  });

  it("surfaces a failed mutation instead of silently reverting", async () => {
    admin.deleteMedia.mockRejectedValue(new Error("Could not delete the image"));
    const user = userEvent.setup();

    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    await user.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    await user.click(screen.getByRole("button", { name: /^remove$|^delete$/i }));

    expect(await screen.findByText(/could not delete the image/i)).toBeInTheDocument();
  });
});
```

Check `ConfirmDialog`'s actual prop and label API before finalising the two dialog assertions — read `frontend/src/components/admin/ConfirmDialog.jsx` and match its real confirm-button label rather than the regex guess above.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/MediaManager.test.jsx`
Expected: FAIL — `Failed to resolve import "./MediaManager"`.

- [ ] **Step 3: Write `MediaManager.jsx`**

`"use client"`. Responsibility: the whole gallery — add, order, describe, remove, and choose the cover.

Constraints:
- **When `propertyId` is null, render only the save-first message.** No drop zone: there is no folder and no ownership check before the listing exists, so an abandoned draft would orphan billable assets.
- Absorb `CoverImagePicker` wholesale — the empty state, the `role="radiogroup"` / `role="radio"` markup, `aria-checked`, the tick-not-colour selection marker, and click-the-current-cover-to-clear. Then **delete `CoverImagePicker.jsx`**; two components owning the same grid drift apart.
- **Mutations are immediate and call `onMediaChange()` on success** — they do not wait for the form's Save. A photo is a file on a server, not a form field; tying it to Save means a validation failure elsewhere in a nine-section form discards a completed upload. The cover radio is the exception: it stays a react-hook-form value, because it is a property of the listing.
- **No optimistic updates**, matching the rest of the admin panel. Show a pending state, then re-render from the server's response.
- Reorder: native HTML5 `draggable` tiles (`onDragStart`/`onDragOver`/`onDrop`), **plus** a "move earlier"/"move later" button pair on each tile. The buttons are not a nicety — HTML5 drag-and-drop is unreachable by keyboard, and gallery order is not an optional feature. Both paths compute the new id array and call `reorderMedia(propertyId, ids)`.
- Alt text is a per-tile input saved on blur when the value actually changed. Do not save on every keystroke.
- Delete goes through `ConfirmDialog`. The wording must say the image is **permanently removed from Cloudinary** — unlike a soft-deleted listing, this is not undoable, and the existing listing-delete copy says the opposite.
- Errors render inline near the gallery, using the API's message verbatim (`error.response?.data?.message ?? error.message`), consistent with `lib/apiErrors.js` handling elsewhere.
- Upload: a labelled file input plus a drop target, `accept={ACCEPTED_TYPES.join(",")}`, `multiple`. Upload files sequentially, not in parallel — each one costs a `strictLimiter`-throttled signature call, and ten at once will hit the limiter. Show per-file progress from `onProgress`, and a per-file retry on failure.
- Use plain `<img>` for tiles, not `next/image` — the existing `CoverImagePicker` comment explains why (admin screen, no SEO or LCP stake, and every Cloudinary host would need configuring). Keep that comment.

- [ ] **Step 4: Wire it into the form**

`frontend/src/components/admin/property/MediaSection.jsx` — swap `CoverImagePicker` for `MediaManager` inside the existing `Controller`, passing `propertyId`, `media` and `onMediaChange`. Keep the floor-plan URL field unchanged. Update the block comment: the "no upload here on purpose" reasoning is no longer true.

`frontend/src/components/admin/PropertyForm.jsx` — thread `propertyId` (`property?._id ?? null`) and `onMediaChange` through to `MediaSection`. Read the file first: `onSaved` already exists and the edit page passes `refetch`, so `onMediaChange` can be the same callback. If it is, say so in a comment rather than adding a second prop that does the same thing.

`frontend/src/app/admin/(panel)/properties/new/page.js` — update the stale comment "no gallery until the media slice exists".

- [ ] **Step 5: Run the tests**

Run: `cd frontend && npx vitest run src/components/admin/MediaManager.test.jsx`
Expected: PASS, 8 tests.

Run: `cd frontend && npm test && npm run lint`
Expected: 138/138 pass (124 baseline + 6 upload + 8 manager), lint clean.

There is no `CoverImagePicker.test.jsx` to delete — the component was only covered indirectly. But `frontend/src/components/admin/PropertyForm.test.jsx` **does** exist and renders the Media section: read it, and update any assertion that depends on the old picker's empty-state copy ("Photo upload arrives with the media slice") or its markup. Do not delete those cases — rewrite them against `MediaManager`.

- [ ] **Step 6: Verify against the real thing**

Add real Cloudinary credentials to `backend/.env`, then:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Sign in at `/admin/login`, open a listing, and confirm by hand: upload two photos with a visible progress bar, reorder them by dragging and by keyboard, edit alt text, set a cover, delete one and see it gone from Cloudinary's media library. Then check the public listing page renders the new gallery.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/MediaManager.jsx frontend/src/components/admin/MediaManager.test.jsx frontend/src/components/admin/property/MediaSection.jsx frontend/src/components/admin/PropertyForm.jsx "frontend/src/app/admin/(panel)/properties/new/page.js"
git rm frontend/src/components/admin/CoverImagePicker.jsx
git commit -m "feat(admin): listing gallery manager with upload, reorder and delete"
```

---

## Task 10: Documentation

**Files:**
- Modify: `docs/API-REFERENCE.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-04-property-media-design.md`

Per `CLAUDE.md`, a change is not finished while the docs still describe the old behaviour, and **response shapes get captured from a running API, never written from memory**.

- [ ] **Step 1: Capture the real response shapes**

With the backend running and real Cloudinary credentials in place, capture each of the five endpoints' actual responses (sign in first to get the cookie):

```bash
cd backend && npm run dev
```

Then, from a second shell, hit each endpoint with `curl` and paste the real JSON into the doc. Redact `signature` and `apiKey` values in the example — they are per-account.

- [ ] **Step 2: Update `docs/API-REFERENCE.md`**

- Add the five endpoints with captured request and response shapes, matching the file's existing format.
- Note the registration contract explicitly: **the client sends only `publicId` and optionally `alt`; url, dimensions and bytes are read back from Cloudinary and any values in the body are ignored.**
- Note that `PATCH .../media/order` requires a full permutation, not a partial list.
- Note the `503` when Cloudinary is unconfigured, and that the rest of the admin surface keeps working.
- **Remove media upload from the "Not built yet" list.**

- [ ] **Step 3: Update `CLAUDE.md`**

- **Status block:** media upload is built. The "No photo upload — the editor picks a cover from a listing's existing media and nothing more" line under admin listings management is now wrong — replace it. Update the "Not built" list (staff management, blog editor, settings admin, §4.3 daily digest, neighbourhood/agent pages, marketing pages, blog remain).
- Update the demo-data description: 600 media are now real Pexels photography, not `placehold.co` stubs, refreshable with `node scripts/fetchDemoImages.js`.
- **Admin endpoint table:** add the five routes.
- **Admin panel conventions:** add the two rules a future session cannot recover from the code —
  1. the registration endpoint re-reads metadata from Cloudinary and ignores the body's, and *why*;
  2. media mutations commit immediately and independently of the form's Save, while the cover stays a form field, and *why*.
- **Public site look and feel:** the placeholder-imagery bullet should now name Pexels demo photography as the thing to replace before launch, and point at `backend/scripts/demoImages.js`.
- Update the final test counts.

- [ ] **Step 4: Record the deviations in the spec**

`docs/superpowers/specs/2026-09-04-property-media-design.md` — under Deferred, note that uploads are capped at 15MB and the chunked/resumable path described in the transport section was **not** built, because 15MB sits below Cloudinary's 20MB unchunked limit and an untested branch that never runs is worse than none. Record any other deviation the implementation made.

- [ ] **Step 5: Full verification**

Run: `cd backend && npm test && npm run lint`
Expected: 252/252 pass, lint clean.

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: 138/138 pass, lint clean, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add docs/API-REFERENCE.md CLAUDE.md docs/superpowers/specs/2026-09-04-property-media-design.md
git commit -m "docs: property media endpoints, demo imagery and conventions"
```

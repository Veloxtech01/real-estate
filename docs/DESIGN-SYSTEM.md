# Design System

The single visual source of truth for the frontend. Generated with `ui-ux-pro-max`,
then adjusted where the automated pick was wrong for this product (noted inline).

**Rebrand rule (§9):** every value below lives as a CSS custom property in
`frontend/src/app/globals.css` and is exposed to Tailwind through `@theme`. Non-colour
brand values (agency name, logo, contact details, socials, nav labels) live in
`frontend/src/config/site.js`. **No component may hardcode a brand colour, font, logo,
or the agency name.** Rebranding a copied repo = editing those two files.

---

## 1. Direction

**Exaggerated Minimalism** — oversized editorial headings, high contrast, generous
negative space, photography carrying the page. Chosen because it is the recommended
style for architecture, luxury and editorial products, and because a property site's
strongest asset is the imagery: the layout's job is to get out of its way.

**Marketplace / Directory conversion pattern**, adapted — this is a single agency, not a
marketplace, so the "become a seller" CTA becomes **"List your property with us"**.

- **Search is the hero CTA.** The homepage hero is a search bar, not a slogan over a
  stock photo. Reducing friction to the first search is the entire conversion path.
- Section order on the homepage: hero search → featured listings → browse by area →
  why us / trust → list-with-us CTA.

**Anti-patterns to avoid** (from the pattern data, both directly relevant here): poor
photography, and no way to explore a property beyond a single image. Hence a real
gallery with a lightbox on the detail page, and a hard rule that a listing without a
cover image gets a designed placeholder, never a broken frame.

---

## 2. Colour tokens

Warm neutral base with a restrained gold accent. Replaces the tool's teal suggestion,
which reads as a generic property portal rather than a premium agency.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-ink` | `#1C1917` | Primary. Headings, primary buttons, footer ground |
| `--color-ink-soft` | `#44403C` | Secondary text, meta, labels |
| `--color-muted` | `#78716C` | Tertiary text — the lightest permitted on `surface` |
| `--color-accent` | `#CA8A04` | Gold. Rules, badges, hover, active states, icon fills |
| `--color-accent-text` | `#A16207` | The AA-safe gold. **Any gold text uses this, not `--color-accent`** |
| `--color-surface` | `#FAFAF9` | Page ground (warm off-white, not pure white) |
| `--color-surface-raised` | `#FFFFFF` | Cards, panels, sheets |
| `--color-border` | `#E7E5E4` | Hairlines, card edges, dividers |
| `--color-text` | `#0C0A09` | Body text |
| `--color-success` | `#15803D` | "Available" status |
| `--color-warning` | `#B45309` | "Under offer" status |
| `--color-danger` | `#B91C1C` | Form errors, "Sold"/"Rented" |

### Contrast rules (non-negotiable)

- `#CA8A04` on `#FAFAF9` is **~3.3:1** — it fails AA for normal text. Gold is for
  borders, rules, icon fills, large display type, and hover states. **Never** small
  gold body text; use `--color-accent-text` (`#A16207`, ~4.6:1) when gold text is
  genuinely wanted.
- Primary buttons are white-on-`ink`. Gold is not a button fill with white text.
- `--color-muted` (`#78716C`, ~4.9:1 on surface) is the lightest text permitted.
  Do not reach for a lighter grey to "soften" something.
- Status is never communicated by colour alone — every status badge carries its label.

### Dark mode

**Out of scope for this slice.** The Next scaffold's `prefers-color-scheme` block in
`globals.css` gets removed rather than half-supported; a property site with a
half-finished dark mode looks worse than one without. If added later, it is a second
`@theme` block, not per-component overrides.

---

## 3. Typography

| Role | Font | Loaded via |
| --- | --- | --- |
| Display / headings | **Playfair Display** (variable) | `next/font/google` |
| Body / UI / data | **Inter** (variable) | `next/font/google` |

Replaces the tool's Cinzel + Josefin Sans pick. Cinzel is an all-caps Roman
inscriptional face — illegible at card sizes and wrong for Nigerian place names.
Josefin Sans has weak numerals, and this interface is unusually number-dense
(`₦150m`, `4 bed`, `3 bath`, `4 toilets`, `450 m²`).

Both are loaded with `next/font/google` (self-hosted, zero layout shift) and bound to
CSS variables in the root layout — **not** via a `<link>` to Google Fonts. Variable
weights only; no per-weight files.

### Scale

Fluid display sizes via `clamp()`; fixed steps below that.

| Step | Size | Use |
| --- | --- | --- |
| `display` | `clamp(2.75rem, 7vw, 5.5rem)`, weight 500, `letter-spacing: -0.03em` | Homepage hero, page titles |
| `h1` | `clamp(2rem, 4vw, 3.25rem)` | Property title, section leads |
| `h2` | `clamp(1.5rem, 2.5vw, 2rem)` | Section headings |
| `h3` | `1.25rem` | Card titles, panel headings |
| `body` | `1rem` / line-height `1.65` | Default. **Never below 16px on mobile** |
| `small` | `0.875rem` | Meta, captions, chips |
| `micro` | `0.75rem`, uppercase, `letter-spacing: 0.08em` | Eyebrow labels, badge text |

- Prose line length capped at **65–75ch** (`max-w-[68ch]`) — descriptions and legal copy.
- Prices use Inter with `font-variant-numeric: tabular-nums` so figures align in a grid.
- Playfair is for display only. It never appears in a form label, a button, or data.

---

## 4. Layout system

- **Container:** `max-w-7xl` (1280px), `px-4 sm:px-6 lg:px-8`. One container width across
  the whole site — no mixing `max-w-6xl` in some sections.
- **Section rhythm:** `py-16 md:py-24 lg:py-32`. The generous end of the range is
  deliberate; whitespace is the style.
- **Grids:** results 1 col → 2 (`sm`) → 3 (`lg`). Featured rail 1 → 2 → 3.
  Detail page 2-column at `lg` (content + sticky enquiry rail), stacked below.
- **Breakpoints tested:** 375, 768, 1024, 1440.
- **Z-index scale:** 10 sticky bars · 20 dropdowns/filter sheet · 30 header ·
  40 lightbox · 50 toasts. No ad-hoc values.
- **Radius:** `0.25rem` on inputs/buttons, `0.5rem` on cards, `0` on full-bleed imagery.
  Restrained, not pill-shaped.
- **Shadows:** used sparingly — a single soft elevation on cards at hover, nothing more.
  This style leans on hairline borders and space, not drop shadows.

---

## 5. Component rules

### Interaction

- Every clickable element gets `cursor-pointer` and a visible hover change.
- Hover uses **colour/opacity/border** transitions, never `scale` — a scaling property
  card in a grid shifts its neighbours and looks amateurish.
- Transitions `150–250ms`, `transform`/`opacity`/`color` only.
- Touch targets ≥ 44×44px. Filter chips, pagination and gallery thumbs are the risk
  areas — pad them, don't shrink them.
- Focus-visible ring on every interactive element: 2px `--color-accent`, 2px offset.
- All motion wrapped in `prefers-reduced-motion` respect. `motion` (Framer) is the only
  animation library.

### Imagery

- `next/image` everywhere. Explicit `sizes` per layout so the browser doesn't fetch a
  1600px file for a 400px card.
- Cover images on the first results row are `priority`; everything below folds is lazy.
- Fixed aspect ratios (`4/3` cards, `16/9` hero, `3/2` gallery) so nothing reflows on
  load — reserved space, no CLS.
- `blurDataUrl`, `width` and `height` are **frequently absent** on real data. Guard every
  one; fall back to a designed placeholder with the agency mark, never a broken frame.
- Alt text is generated from the listing (`"4 bedroom duplex in Lekki Phase 1"`), never
  empty on a meaningful image.

### Loading & empty states

- Skeletons, not spinners, for content areas — `loading.js` per route with card
  skeletons matching the real grid's dimensions.
- Buttons disable and show progress during submit; forms never freeze silently.
- Zero-result search never shows a bare empty page: it shows the relaxation notice, the
  chips that were applied, and a route back to a broader search.

### Icons

- `react-icons` only, imported per-icon (`import { FiMapPin } from 'react-icons/fi'`).
  One set — Feather (`fi`) — across the whole site. **No emoji as icons, ever.**
- Icon-only buttons carry an `aria-label`.

### Forms

- `react-hook-form` for anything with more than one field.
- Labels are real `<label for>` elements; placeholders are not labels.
- Errors render next to the offending field, mapped from the API's `details` object.
- Success is a `react-hot-toast`, from a single `<Toaster />` at the root.

---

## 6. Pre-delivery checklist

Run against every page before it is called done.

- [ ] No emoji icons; all icons from `react-icons/fi`
- [ ] `cursor-pointer` on everything clickable
- [ ] Hover states cause no layout shift
- [ ] Focus-visible ring present and visible
- [ ] Body text ≥ 16px on mobile; prose ≤ 75ch
- [ ] Text contrast ≥ 4.5:1 (gold text uses `--color-accent-text`)
- [ ] Status conveyed by label, not colour alone
- [ ] All images have real alt text and reserved space
- [ ] `prefers-reduced-motion` respected
- [ ] No horizontal scroll at 375 / 768 / 1024 / 1440
- [ ] No brand string, colour or font hardcoded in a component

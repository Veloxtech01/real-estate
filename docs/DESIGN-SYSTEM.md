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

Brand palette: **Navy `#0D1B2A` · Ivory `#F7F3EA` · Gold `#C6A15B` · Taupe `#9B9185`.**
The four hues are the identity; the tokens below are their WCAG-safe working forms.
Gold and taupe both fail AA as text on ivory, so each has a darkened sibling that
carries text while the brand hue stays decorative.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-ink` | `#0D1B2A` | Brand navy. Headings, primary buttons, dark section grounds (15.7:1) |
| `--color-ink-deep` | `#081320` | Navy pushed darker. Header, footer, hero scrim, page-header bands |
| `--color-ink-raised` | `#16283C` | Navy lifted. Panels and inputs sitting **on** navy — the dark `surface-raised` |
| `--color-ink-soft` | `#35485C` | Secondary text, meta, labels (8.5:1) |
| `--color-muted` | `#6B6357` | Tertiary text — taupe darkened, the lightest permitted on `surface` (5.4:1) |
| `--color-accent` | `#C6A15B` | Brand gold. Decorative rules, icon fills, hover washes, large display type |
| `--color-accent-text` | `#7E6124` | The AA-safe gold on **ivory** (5.2:1). Gold text on ivory, and the light focus ring |
| `--color-accent-hover` | `#D8B981` | Gold lifted, for hover on a gold fill — a fill hovers brighter, never darker |
| `--color-taupe` | `#9B9185` | Brand taupe. Decorative only (2.8:1): dividers, empty-state art, image scrims |
| `--color-surface` | `#F7F3EA` | Page ground (brand ivory) |
| `--color-surface-raised` | `#FFFDF7` | Cards, panels, sheets — ivory lifted, so a card reads above the page |
| `--color-border` | `#E3DCCB` | Hairlines, card edges, dividers |
| `--color-text` | `#0A1620` | Body text |
| `--color-success` | `#167A3C` | "Available" status (4.9:1) |
| `--color-warning` | `#9A5B12` | "Under offer" status (4.9:1) |
| `--color-danger` | `#B3261E` | Form errors, "Sold"/"Rented" (5.9:1) |

### Contrast rules (non-negotiable)

- `#C6A15B` on `#F7F3EA` is **~2.2:1** — it fails AA for text *and* the 3:1 minimum for
  meaningful non-text UI. Gold is decoration: hover washes, icon fills, large display
  type, and rules that duplicate a boundary the `border` token already draws. **Never**
  small gold text, and never a border that is the only thing marking an edge.
- The focus ring is `--color-accent-text`, not `--color-accent` — at 2.2:1 the brand
  gold would be an invisible focus indicator.
- `--color-taupe` is decorative only at 2.8:1. Taupe *text* is `--color-muted`.
- Primary buttons are white-on-`ink`. Gold is not a button fill with white text.
- `--color-muted` (`#6B6357`, ~5.4:1 on surface) is the lightest text permitted.
  Do not reach for a lighter grey to "soften" something.
- Status is never communicated by colour alone — every status badge carries its label.
- On navy grounds ivory is 15.7:1 and gold is **6.6:1** — gold *is* permitted as text,
  as a fill and as a meaningful border there. The restriction is gold-on-ivory, not gold
  everywhere. **This asymmetry is why the site alternates ivory and navy sections:**
  navy is where the accent is allowed to be loud, so the layout earns its colour by
  changing ground rather than by pushing gold past its contrast on ivory.
- A gold **fill** always carries navy text (6.6:1). Gold with white text is 1.9:1 and is
  never permitted — this is what `Button`'s `accent` variant encodes.
- The focus ring flips with the ground. `:focus-visible` is `--color-accent-text` by
  default; anything inside an element marked **`.on-dark`** switches to `--color-accent`.
  Every navy region — header, hero, dark `Section`, footer, mobile drawer, search panel,
  page-header band — must carry `on-dark`, or keyboard focus disappears inside it.

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
- **Section tone is the primary visual device.** `Section` takes
  `tone="light" | "raised" | "dark"` and owns the ground *and* the heading colours
  together, so a tone can never be half-applied. Pages alternate: the homepage runs navy
  hero → ivory featured → navy stats → ivory areas → navy trust → raised testimonials →
  navy CTA. Never hand-roll a `bg-` class on a section instead of passing a tone.
- **Every page opens and closes on navy.** The header and footer are `ink-deep`, and
  inner pages get a navy page-header band (see `/properties`) rather than starting on
  bare ivory. Without it, page two looks like a different site from the homepage.
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

### Accent weight

- **Accents have mass, not hairlines.** An icon is a filled disc
  (`bg-accent/15 text-accent ring-1 ring-accent/30`), not a bare outline glyph; a badge
  is a solid fill, not a 10% wash. A 1px gold rule is a supporting mark under a heading,
  never the only accent in a section.
- **Badges are solid fills with a contrasting label** — white on the three status
  colours, navy on gold. A status badge always sits on a photograph, so it must carry
  its own ground or it reads as whatever the image is behind it.
- **One primary action per region gets the gold fill.** `Button`'s `accent` variant is
  the loudest control on the site; competing gold fills in one region mean none of them
  reads as primary — which is why the hero's secondary CTAs are outlined and the gold
  belongs to the search submit. Two instances of the *same* action (the hero's free-text
  submit and its panel submit) are fine; two *different* actions are not.

### Imagery

- `next/image` everywhere. Explicit `sizes` per layout so the browser doesn't fetch a
  1600px file for a 400px card.
- Cover images on the first results row are `priority`; everything below folds is lazy.
- Fixed aspect ratios (`4/3` cards, `16/9` hero, `3/2` gallery) so nothing reflows on
  load — reserved space, no CLS.
- `blurDataUrl`, `width` and `height` are **frequently absent** on real data. Guard every
  one; fall back to a designed placeholder with the agency mark, never a broken frame.
- Alt text is generated from the listing (`"4 bedroom duplex in Lekki Phase 1"`), never
  empty on a meaningful image. The **hero photograph is the exception**: it is decorative
  stock, so its alt is empty on purpose — describing it would announce a property the
  agency is not offering.
- **A photograph behind text always carries a scrim.** White display type over an
  unmodified photo is unreadable wherever the image happens to be pale, and the hero
  image is placeholder stock that gets swapped per client — so contrast can never depend
  on a particular photo being dark. The homepage hero uses two gradients: a horizontal
  wash for the copy, and a vertical one that lands the bottom edge on solid navy so the
  search panel joins without a seam.
- Hero and other placeholder assets in `/public` are credited in
  `frontend/public/CREDITS.md` and must be replaced with the agency's own photography
  before a client launch.

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

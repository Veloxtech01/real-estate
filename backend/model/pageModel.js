import mongoose from "mongoose";
import { PUBLICATION_STATES } from "../utils/constants.js";

/**
 * Page — editable marketing page content (homepage, about, services, legal).
 *
 * This collection is what makes §9's "content in the database, not in code" real:
 * homepage hero copy, service descriptions and about text live here, so a client's
 * wording change is an admin edit rather than a deployment. It is also what lets a
 * copied repo be re-seeded for a new client without touching components.
 *
 * Legal pages (terms, privacy notice, listing disclaimer, cookie notice — §4.1) are
 * ordinary Page records; §11 requires a Nigerian lawyer to review their content
 * before launch, which is a content task, not a code one.
 */

/**
 * A content block within a page.
 *
 * `data` is intentionally Mixed: a hero, a services grid and a rich-text section
 * hold genuinely different shapes, and pinning a schema per block type here would
 * mean a migration every time the client wants a new section layout.
 */
const sectionSchema = new mongoose.Schema(
  {
    // Which component renders this block, e.g. "hero", "richText", "servicesGrid".
    type: {
      type: String,
      required: [true, "Section type is required"],
      trim: true,
    },

    // Block payload — headline, body, image URLs, CTA labels.
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Render order within the page.
    order: { type: Number, default: 0 },

    // Lets a client hide a section without deleting its content.
    isVisible: { type: Boolean, default: true },
  },
  { _id: false }
);

const pageSchema = new mongoose.Schema(
  {
    /**
     * Stable machine key the front end looks the page up by, e.g. "home",
     * "about", "services.sales", "legal.privacy".
     *
     * Separate from slug so a client can rename a page's URL without breaking the
     * component that renders it.
     */
    key: {
      type: String,
      required: [true, "Page key is required"],
      trim: true,
      lowercase: true,
    },

    /**
     * URL segment. Left unset for pages rendered at a fixed route (e.g. the
     * homepage).
     *
     * Deliberately has no default: a `sparse` unique index skips only *missing*
     * fields, so defaulting this to null would make every slug-less page collide
     * with the last one.
     */
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    sections: {
      type: [sectionSchema],
      default: [],
    },

    publicationState: {
      type: String,
      enum: PUBLICATION_STATES,
      default: "draft",
    },

    /**
     * Marks pages the site cannot function without (homepage, privacy notice).
     * Deleting one should be blocked in the admin panel — a client removing the
     * privacy notice is an NDPA problem (§11), not just a broken link.
     */
    isSystem: {
      type: Boolean,
      default: false,
    },

    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
  },
  { timestamps: true }
);

// The lookup every rendered page performs.
pageSchema.index({ key: 1 }, { unique: true });

/**
 * Slug lookup for pages that have a URL.
 *
 * A partial index rather than a sparse one: sparse only excludes documents missing
 * the field, so a caller explicitly writing `slug: null` would still collide with
 * every other null. Restricting the index to string values covers both cases.
 */
pageSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } }
);

export default mongoose.model("Page", pageSchema);

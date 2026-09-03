import mongoose from "mongoose";

/**
 * Location — a canonical neighbourhood, city or state record.
 *
 * Two jobs: it powers the "Areas we cover" landing pages (§3), and it is the
 * whitelist the AI search validates extracted locations against (§5.2 step 4). A
 * location the model invents simply won't exist here, so it gets discarded rather
 * than reaching a query.
 */
const locationSchema = new mongoose.Schema(
  {
    // Display name as written on the site, e.g. "Lekki Phase 1".
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
    },

    // URL segment for the neighbourhood landing page, e.g. "lekki-phase-1".
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Nigerian state. Drives the rent-rule lookup (Lagos caps agency fees at 10%),
    // so it is required even on a neighbourhood record.
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      index: true,
    },

    // Local government area — optional, since not every listing area maps cleanly.
    lga: {
      type: String,
      trim: true,
    },

    // Self-reference building the hierarchy (state > city > neighbourhood) without a
    // second collection. Null for a top-level entry.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },

    // Editorial copy for the landing page — kept in the DB, not in code, so client
    // staff can edit it without a deployment (§9).
    description: {
      type: String,
      trim: true,
    },

    // Approximate centre, used to frame the map on an area page. Individual listings
    // carry their own pin (§10.2) — this is not used for proximity search.
    centre: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
    },

    // Whether the area page is live. Areas can be created for tagging before their
    // landing page copy is ready.
    isPublished: {
      type: Boolean,
      default: false,
    },

    // Per-page SEO overrides; falls back to generated values when empty (§4.4).
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
  },
  { timestamps: true }
);

// One canonical record per slug — the alias collection absorbs spelling variants,
// so duplicates here would mean two competing "Lekki" pages splitting SEO value.
locationSchema.index({ slug: 1 }, { unique: true });

// Supports listing the neighbourhoods within a state for nav and area indexes.
locationSchema.index({ state: 1, name: 1 });

export default mongoose.model("Location", locationSchema);

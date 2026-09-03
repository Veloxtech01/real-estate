import mongoose from "mongoose";
import { TAXONOMY_CATEGORIES } from "../utils/constants.js";

/**
 * Taxonomy — one tagged vocabulary for amenities, facilities, features and security.
 *
 * The original brief had these as four overlapping fields; §8.1 collapses them into a
 * single collection with a category, so "24/7 power" doesn't have to be classified
 * into one of four near-identical buckets at listing time.
 *
 * Like Location, this doubles as an AI-search whitelist (§5.2 step 4): an amenity the
 * model invents has no row here and is discarded.
 */
const taxonomySchema = new mongoose.Schema(
  {
    // Display label, e.g. "Swimming pool".
    name: {
      type: String,
      required: [true, "Taxonomy name is required"],
      trim: true,
    },

    // Stable machine key used in filters and URLs, e.g. "swimming_pool". Filters
    // reference this rather than the label so renaming a label doesn't break links.
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // Which of the four collapsed groups this term belongs to.
    category: {
      type: String,
      enum: {
        values: TAXONOMY_CATEGORIES,
        message: "{VALUE} is not a valid taxonomy category",
      },
      required: [true, "Taxonomy category is required"],
      index: true,
    },

    // Alternative phrasings a visitor might type — the amenity equivalent of the
    // location alias table (§5.4: "serviced", "gated estate", "BQ", "prepaid meter").
    aliases: {
      type: [String],
      default: [],
      // Stored lowercase so free-text matching is case-insensitive without a regex.
      set: (values) => values.map((value) => value.trim().toLowerCase()),
    },

    // Optional react-icons name so the front end can render a consistent icon per
    // amenity without a hardcoded mapping in a component.
    icon: {
      type: String,
      trim: true,
    },

    // Controls ordering in filter panels and on the property detail page; equal
    // values fall back to alphabetical.
    displayOrder: {
      type: Number,
      default: 0,
    },

    // Lets a term be retired without deleting it and orphaning historic listings.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Keys are the filter contract, so they must be globally unique — a duplicate would
// make "amenities=parking" ambiguous.
taxonomySchema.index({ key: 1 }, { unique: true });

// Supports rendering a filter panel section (all active amenities, in order).
taxonomySchema.index({ category: 1, displayOrder: 1 });

// Resolves a free-text amenity phrase to a term during AI-search validation.
taxonomySchema.index({ aliases: 1 });

export default mongoose.model("Taxonomy", taxonomySchema);

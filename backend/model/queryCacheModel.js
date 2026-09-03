import mongoose from "mongoose";

/**
 * QueryCache — normalised search phrase to parsed filters (§5.2 step 2, §5.6).
 *
 * The primary cost control for AI search. Visitors phrase requests very similarly
 * ("3 bed flat in lekki", "3 bedroom flat in Lekki"), so hit rates are high and
 * **most searches should never reach the model at all**. Without this, a public
 * search box is an uncapped bill exposed to the open internet.
 *
 * Separate from SearchLog on purpose: SearchLog is an append-only analytics record
 * of every search, whereas this is a mutable key-value store with one row per
 * distinct phrase.
 */
const queryCacheSchema = new mongoose.Schema(
  {
    // The cache key: lowercased, punctuation-lightened, whitespace-collapsed.
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * The parsed filter object, **before** database resolution.
     *
     * Pre-resolution on purpose: location and taxonomy ids can change when a client
     * edits their vocabulary, so caching resolved ids would serve stale references.
     * Re-resolving on each hit is a cheap indexed lookup.
     */
    filters: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Which path produced this entry — "parser" costs nothing, "model" cost money.
    // Useful for measuring how much traffic the deterministic parser absorbs.
    parsedBy: {
      type: String,
      enum: ["parser", "model", "hybrid"],
      required: true,
    },

    // How often this phrase has been served from cache. The headline metric for
    // whether the caching strategy in §5.6 is actually working.
    hits: {
      type: Number,
      default: 0,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// The cache lookup, and the guarantee of one row per phrase.
queryCacheSchema.index({ normalizedQuery: 1 }, { unique: true });

/**
 * Expire entries 30 days after last use.
 *
 * Bounded so the collection can't grow without limit, and so a phrase parsed before
 * the client added new locations eventually gets re-parsed against the fuller
 * vocabulary.
 */
queryCacheSchema.index({ lastUsedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model("QueryCache", queryCacheSchema);

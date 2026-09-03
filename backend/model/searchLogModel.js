import mongoose from "mongoose";
import { SEARCH_SOURCES } from "../utils/constants.js";

/**
 * SearchLog — one logged search, with its parsed filters and outcome (§5.7).
 *
 * This produces a demand report the agency cannot get anywhere else: which areas are
 * being searched, at what budgets, and which searches consistently return nothing.
 * It directly informs which stock to acquire, which is why zero-result searches are
 * logged as carefully as successful ones.
 *
 * **No personal data is stored here** (§5.7). Not the enquirer's name, phone, email
 * or IP — only the phrase, the filters, and the outcome. Anything identifying belongs
 * on Enquiry, where consent is recorded.
 */
const searchLogSchema = new mongoose.Schema(
  {
    // The phrase as typed, for the AI path. Empty for a pure filter search.
    rawQuery: {
      type: String,
      trim: true,
    },

    /**
     * Normalised form of the phrase — lowercased, whitespace collapsed.
     *
     * Doubles as the parse cache key (§5.6): visitors phrase requests similarly, so
     * most searches should resolve from a previous parse and never reach the model.
     */
    normalizedQuery: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    // The validated filters that actually ran. Mixed because the filter shape will
    // grow (§5.3) and this is an analytics record, not a queried entity.
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    source: {
      type: String,
      enum: SEARCH_SOURCES,
      default: "filter",
      index: true,
    },

    // Whether the parse came from cache. The hit rate is the cost-control metric for
    // §5.6 — if it drops, the model spend rises with it.
    cacheHit: {
      type: Boolean,
      default: false,
    },

    // How many listings came back. Zero is the interesting case: it is both a lost
    // visitor and a stock-acquisition signal.
    resultCount: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    /**
     * Which constraints were relaxed to rescue a zero-result search, in the order
     * applied (§5.5: price band, then adjacent neighbourhoods, then bedrooms).
     * Recorded so the relaxation ladder can be tuned against real data.
     */
    relaxedConstraints: {
      type: [String],
      default: [],
    },

    // Did this search turn into a lead? The whole point of §5.7's demand report is
    // correlating searched-for stock with conversion.
    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
    },

    // Model latency in milliseconds, for the §5.6 two-second timeout budget.
    parseDurationMs: {
      type: Number,
    },
  },
  { timestamps: true }
);

// The core demand report: recent searches, and the zero-result subset within them.
searchLogSchema.index({ createdAt: -1 });
searchLogSchema.index({ resultCount: 1, createdAt: -1 });

export default mongoose.model("SearchLog", searchLogSchema);

import mongoose from "mongoose";

/**
 * LocationAlias — maps informal names and misspellings onto a canonical Location.
 *
 * This is the alias table from §5.4: visitors type "VI", "Lekki phase1", "Ikoyi
 * Lagos" and "Chevron", none of which match a canonical record directly. It sits
 * between the AI model's output and the database, and is content work populated with
 * the client during content loading — not something to guess at in code.
 */
const locationAliasSchema = new mongoose.Schema(
  {
    // The alias as a visitor might type it. Normalised (lowercased, trimmed) on save
    // so lookups don't have to worry about casing.
    alias: {
      type: String,
      required: [true, "Alias is required"],
      trim: true,
      lowercase: true,
    },

    // The canonical location this alias resolves to.
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: [true, "Alias must resolve to a location"],
      index: true,
    },

    // Where the alias came from. Aliases mined from failed searches (§5.7) are worth
    // reviewing before trusting, unlike ones entered deliberately by staff.
    source: {
      type: String,
      enum: ["manual", "search_log"],
      default: "manual",
    },
  },
  { timestamps: true }
);

// An alias must resolve to exactly one location — two rows for "VI" would make
// resolution ambiguous and silently non-deterministic.
locationAliasSchema.index({ alias: 1 }, { unique: true });

export default mongoose.model("LocationAlias", locationAliasSchema);

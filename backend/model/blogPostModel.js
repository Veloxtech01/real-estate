import mongoose from "mongoose";
import { PUBLICATION_STATES } from "../utils/constants.js";

/**
 * BlogPost — blog and market insights, with categories and tags (§4.1).
 *
 * Exists for organic search: neighbourhood and market-commentary posts are cheap to
 * produce and are a significant share of the traffic that eventually converts, which
 * is the same reasoning behind the area landing pages.
 */
const blogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Summary used on index cards and as the meta description fallback.
    excerpt: {
      type: String,
      trim: true,
    },

    // Post body (HTML or Markdown from the admin editor — §4.2).
    body: {
      type: String,
      required: [true, "Body is required"],
    },

    coverImage: { type: String, trim: true },

    // Staff author, so a post can double as a credibility signal for that agent.
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },

    // Free-form strings rather than a taxonomy reference: editorial categories churn
    // independently of the property vocabulary and don't gate any search filter.
    categories: {
      type: [String],
      default: [],
      set: (values) => values.map((v) => v.trim()),
    },
    tags: {
      type: [String],
      default: [],
      set: (values) => values.map((v) => v.trim().toLowerCase()),
    },

    // Optional link to areas the post discusses — powers cross-linking between a
    // neighbourhood page and its market commentary.
    locations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
      },
    ],

    publicationState: {
      type: String,
      enum: PUBLICATION_STATES,
      default: "draft",
      index: true,
    },

    // Set on first publication; drives ordering on the blog index.
    publishedAt: { type: Date },

    // Soft delete, consistent with Property — a removed post's URL may still be
    // linked from elsewhere, and hard-deleting loses that history.
    deletedAt: { type: Date, default: null },

    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
  },
  { timestamps: true }
);

// Post URL lookup.
blogPostSchema.index({ slug: 1 }, { unique: true });

// The blog index: published posts, newest first.
blogPostSchema.index({ publicationState: 1, publishedAt: -1 });

// Category and tag archive pages.
blogPostSchema.index({ categories: 1 });
blogPostSchema.index({ tags: 1 });

// Full-text search across post content.
blogPostSchema.index(
  { title: "text", excerpt: "text", body: "text" },
  { weights: { title: 10, excerpt: 5, body: 1 }, name: "blog_text" }
);

/**
 * Stamps publishedAt on first publication only, so editing an old post doesn't
 * push it back to the top of the index.
 */
blogPostSchema.pre("save", async function () {
  if (
    this.isModified("publicationState") &&
    this.publicationState === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
});

export default mongoose.model("BlogPost", blogPostSchema);

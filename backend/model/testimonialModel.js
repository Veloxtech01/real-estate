import mongoose from "mongoose";

/**
 * Testimonial — agency-curated client feedback (§3).
 *
 * **Not a public review system.** The marketplace's review collection was removed
 * from scope entirely; these are entered by staff, and there is no public submission
 * path. That distinction matters: a public review system carries moderation,
 * defamation and verification obligations this project deliberately does not take on.
 */
const testimonialSchema = new mongoose.Schema(
  {
    // Client's name as they agreed it may be displayed.
    clientName: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },

    // Optional context line, e.g. "Tenant, Lekki Phase 1" — adds credibility without
    // exposing anything identifying.
    clientTitle: {
      type: String,
      trim: true,
    },

    quote: {
      type: String,
      required: [true, "Quote is required"],
      trim: true,
    },

    // Cloudinary URL. Optional — many clients won't supply a photograph.
    photo: {
      type: String,
      trim: true,
    },

    // Optional links for cross-referencing on an agent profile or property page.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },

    // Curated rather than aggregated — no average is computed or displayed, because
    // that would imply a review system.
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Homepage/testimonials-page ordering, set by staff.
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// The published testimonial rail, in the order staff arranged it.
testimonialSchema.index({ isPublished: 1, displayOrder: 1 });

export default mongoose.model("Testimonial", testimonialSchema);

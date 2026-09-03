import mongoose from "mongoose";

/**
 * PropertyMedia — one image or video belonging to a listing.
 *
 * A separate collection rather than an array on Property because §4.2 requires
 * drag-and-drop reordering, per-image cover selection, and generated thumbnail/
 * watermark variants — all of which mean per-image documents that are updated
 * independently of the listing itself.
 */
const propertyMediaSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Media must belong to a property"],
      index: true,
    },

    // Cloudinary delivery URL for the full-size processed image (§10.1).
    url: {
      type: String,
      required: [true, "Media URL is required"],
      trim: true,
    },

    // Cloudinary public_id — needed to delete or re-transform the asset later. Losing
    // it orphans the file in Cloudinary with no way to clean it up.
    publicId: {
      type: String,
      required: true,
      trim: true,
    },

    // Derived variants generated on upload. Stored rather than built on the fly so
    // the front end never guesses a transformation URL that may not exist.
    thumbnailUrl: { type: String, trim: true },
    watermarkedUrl: { type: String, trim: true },

    // Low-quality placeholder (data URI) for the blurred-placeholder loading pattern
    // required by the sub-1MB listing page target (§10.3).
    blurDataUrl: { type: String },

    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },

    // Alt text — an accessibility requirement and an SEO signal on image search.
    alt: {
      type: String,
      trim: true,
    },

    // Drag-and-drop gallery position (§4.2). Not unique: reordering swaps values in
    // bulk, and a transient duplicate mid-reorder must not fail the write.
    displayOrder: {
      type: Number,
      default: 0,
    },

    // Original dimensions, used to reserve layout space and avoid the content shift
    // that hurts mobile performance scores (§10.3).
    width: { type: Number },
    height: { type: Number },

    // Processed size in bytes — lets an admin spot listings breaching the page-weight
    // budget before they go live.
    bytes: { type: Number },
  },
  { timestamps: true }
);

// The gallery query: every image for a listing, already in display order.
propertyMediaSchema.index({ property: 1, displayOrder: 1 });

// Cloudinary's id is the deletion key, so duplicates would mean deleting one record
// silently breaks another.
propertyMediaSchema.index({ publicId: 1 }, { unique: true });

export default mongoose.model("PropertyMedia", propertyMediaSchema);

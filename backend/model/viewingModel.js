import mongoose from "mongoose";
import { VIEWING_STATUSES } from "../utils/constants.js";

/**
 * Viewing — a request to inspect a property, with accept/reject/reschedule (§4.2).
 *
 * Separate from Enquiry because it has its own lifecycle, its own scheduled date,
 * and its own notification pair (§4.3: email to the agent, confirmation to the
 * prospect). An enquiry that becomes a viewing links the two.
 */
const viewingSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "A viewing must reference a property"],
      index: true,
    },

    // The agent who will conduct the viewing — denormalised at creation, as with
    // Enquiry, so reassigning the listing doesn't rewrite history.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
      index: true,
    },

    // The enquiry this grew out of, when there was one. Lets the inbox show the full
    // thread rather than two unconnected records for the same person.
    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
    },

    // --- Prospect (personal data — see the NDPA note on Enquiry) ------------------

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    // --- Scheduling --------------------------------------------------------------

    // When the prospect asked to view.
    requestedFor: {
      type: Date,
      required: [true, "A requested date is required"],
    },

    // When it will actually happen, once accepted or rescheduled. Kept separate from
    // requestedFor so the agency can see how far a viewing moved from the ask.
    scheduledFor: {
      type: Date,
    },

    status: {
      type: String,
      enum: VIEWING_STATUSES,
      default: "requested",
      index: true,
    },

    // Shown to the prospect on a rejection or reschedule, so the confirmation email
    // can explain itself rather than just changing state silently.
    responseMessage: {
      type: String,
      trim: true,
    },

    // Internal only.
    notes: {
      type: String,
      trim: true,
      select: false,
    },

    // Stamped when staff first accept/reject/reschedule — the response-time metric
    // for viewings, mirroring Enquiry.contactedAt.
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

// The agent's viewing diary: upcoming viewings in date order.
viewingSchema.index({ agent: 1, scheduledFor: 1 });

// Admin queue of unanswered requests.
viewingSchema.index({ status: 1, requestedFor: 1 });

/**
 * Stamps respondedAt and defaults the scheduled date on acceptance.
 */
viewingSchema.pre("save", async function () {
  if (!this.isModified("status")) return;

  if (this.status !== "requested" && !this.respondedAt) {
    this.respondedAt = new Date();
  }

  // Accepting without changing the date means the requested slot stands — copy it
  // across so downstream code only ever reads scheduledFor.
  if (this.status === "accepted" && !this.scheduledFor) {
    this.scheduledFor = this.requestedFor;
  }
});

export default mongoose.model("Viewing", viewingSchema);

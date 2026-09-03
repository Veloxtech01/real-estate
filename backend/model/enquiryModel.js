import mongoose from "mongoose";
import {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  ENQUIRY_SOURCES,
} from "../utils/constants.js";

/**
 * Enquiry — a lead. The entire commercial point of the site (§1).
 *
 * Covers every inbound contact form: a property enquiry, the "list your property
 * with us" supply pipeline (§3), a valuation request, and the §5.5 no-match alert.
 * One collection with a `type` rather than four near-identical ones, so the agency
 * works a single inbox (§4.2).
 *
 * NDPA note: this collection holds personal data (name, phone, email). Processing
 * more than 200 data subjects in six months brings the client into the NDPC
 * registration category (§11), which is why consent and retention are modelled here
 * rather than left implicit.
 */
const enquirySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: { values: ENQUIRY_TYPES, message: "{VALUE} is not a valid enquiry type" },
      default: "property_enquiry",
      index: true,
    },

    // The listing enquired about. Optional: a contact-page or list-your-property
    // enquiry has no property attached.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },

    /**
     * The agent this lead is routed to (§4.3 — they get the notification email with
     * the WhatsApp click-to-chat link).
     *
     * Denormalised from the property at creation rather than resolved on read, so
     * reassigning the listing later doesn't silently move historic leads to someone
     * who never handled them.
     */
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
      index: true,
    },

    // --- Enquirer (personal data) ------------------------------------------------

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    // Phone is the primary channel in this market — WhatsApp click-to-chat is built
    // from it (§10.1), so it is required where email is not.
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

    message: {
      type: String,
      trim: true,
    },

    /**
     * The requirement behind a no-match alert (§5.5): "we don't have this right now,
     * leave your number". Stored as the parsed filter object so the agency can match
     * it against new stock — a qualified lead with a known requirement is worth more
     * than the search that produced it.
     */
    requirement: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },

    // --- Pipeline ----------------------------------------------------------------

    status: {
      type: String,
      enum: ENQUIRY_STATUSES,
      default: "new",
      index: true,
    },

    source: {
      type: String,
      enum: ENQUIRY_SOURCES,
      default: "property_page",
    },

    // Internal staff notes — never exposed on any public endpoint.
    notes: {
      type: String,
      trim: true,
      select: false,
    },

    // Set when status first moves off "new". Together with createdAt this gives the
    // agency a response-time metric, which is the number that actually predicts
    // whether a lead converts.
    contactedAt: { type: Date },
    closedAt: { type: Date },

    // --- Compliance (NDPA 2023, §11) ---------------------------------------------

    // Consent to be contacted about this specific enquiry, captured at submission.
    consentGiven: {
      type: Boolean,
      default: false,
    },
    consentedAt: { type: Date },

    // Separate, explicit opt-in for future marketing. Deliberately distinct from
    // consentGiven: agreeing to be called back about one property is not agreement
    // to receive listing alerts.
    marketingOptIn: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// The enquiry inbox view: open leads, newest first (§4.2).
enquirySchema.index({ status: 1, createdAt: -1 });

// An agent's own leads — the Phase 2 agent dashboard and the daily digest.
enquirySchema.index({ agent: 1, status: 1, createdAt: -1 });

/**
 * Timestamps the pipeline transitions.
 *
 * Mongoose 9 pre-middleware is async and takes no next().
 */
enquirySchema.pre("save", async function () {
  if (!this.isModified("status")) return;

  // Only stamp the first move off "new" — a later status change shouldn't overwrite
  // the original response time.
  if (this.status !== "new" && !this.contactedAt) {
    this.contactedAt = new Date();
  }

  if (this.status === "closed" && !this.closedAt) {
    this.closedAt = new Date();
  }
});

export default mongoose.model("Enquiry", enquirySchema);

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { STAFF_ROLES } from "../utils/constants.js";

// Work factor for bcrypt. 12 is a deliberate cost/latency trade: high enough to be
// expensive to brute-force, low enough that admin login stays responsive.
const SALT_ROUNDS = 12;

/**
 * Agent — a staff account, and simultaneously a public profile page.
 *
 * One collection serves both because they're the same person: §7 defines only
 * administrator and agent as accounts (visitors are unauthenticated in Phase 1), and
 * §3 wants agent profiles as public trust signals and referral landing pages.
 *
 * There is no self-service registration by design — an administrator creates these,
 * which removes an entire category of spam and identity-verification work (§7).
 */
const agentSchema = new mongoose.Schema(
  {
    // Full display name, used on the profile page and the property agent card.
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    // URL segment for the public profile, e.g. "/team/adaeze-okonkwo".
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Login identity. Lowercased so the same address can't register twice in
    // different casing.
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    // bcrypt hash — never the raw password. select:false keeps it out of every
    // ordinary query, so it can't leak through a route that returns an agent.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    // Office line shown publicly.
    phone: {
      type: String,
      trim: true,
    },

    // WhatsApp number in international format — powers the click-to-chat links that
    // replace the Business API (§10.1). Stored separately because it is frequently a
    // different line from the office phone.
    whatsapp: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      enum: {
        values: STAFF_ROLES,
        message: "{VALUE} is not a valid staff role",
      },
      default: "agent",
      index: true,
    },

    /**
     * Whether this agent may publish a listing directly, or must leave it in draft
     * for an administrator to approve. §7 explicitly leaves this to the client, so it
     * is per-agent data rather than a hardcoded rule. Defaults to the safer option.
     */
    canPublish: {
      type: Boolean,
      default: false,
    },

    // Job title shown on the profile card, e.g. "Senior Sales Consultant".
    position: {
      type: String,
      trim: true,
    },

    // Profile copy — a trust signal, so it lives in the DB for client editing (§9).
    bio: {
      type: String,
      trim: true,
    },

    // Cloudinary URL for the profile photograph.
    photo: {
      type: String,
      trim: true,
    },

    // Areas this agent covers — drives "agents in Lekki" style cross-linking between
    // neighbourhood pages and profiles.
    areas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
      },
    ],

    // Optional professional registration number, displayed as a trust signal
    // alongside the agency's LASRERA number (§11).
    registrationNumber: {
      type: String,
      trim: true,
    },

    // Deactivating hides the profile and blocks login without deleting the account,
    // which would orphan every listing and enquiry the agent handled.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Whether the profile appears on the public "Meet the team" page. Separate from
    // isActive so back-office staff can hold an account without a public profile.
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Set on successful login — useful for spotting dormant accounts to deactivate.
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Belt-and-braces: even if a query explicitly selects the hash, it never
      // survives serialisation into a response body.
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Login lookup, and prevents two accounts sharing an address.
agentSchema.index({ email: 1 }, { unique: true });

// Public profile URL lookup.
agentSchema.index({ slug: 1 }, { unique: true });

/**
 * Hashes the password before saving.
 *
 * Mongoose 9 pre-middleware takes no next() callback — it must be async or return a
 * promise (see the Mongoose 9 migration guide).
 */
agentSchema.pre("save", async function () {
  // Only rehash when the password actually changed, otherwise every profile edit
  // would re-hash the existing hash and invalidate the account's credentials.
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

/**
 * Verifies a plaintext password against the stored hash.
 *
 * Takes: candidate (string) — the password as submitted at login.
 * Returns: a promise resolving true when it matches.
 * Note: the document must have been queried with .select("+password"), since the
 *       field is excluded by default.
 */
agentSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) {
    throw new Error("Password not loaded — query with .select('+password')");
  }

  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("Agent", agentSchema);

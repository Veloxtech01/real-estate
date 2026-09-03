import mongoose from "mongoose";

/**
 * Settings — the single site configuration document.
 *
 * Three jobs in one record:
 *  1. Site settings a client edits themselves: contact details, social links, office
 *     hours, homepage copy (§4.2).
 *  2. The theme configuration from §9 — the one place brand values live, so a copied
 *     repo is rebranded here rather than by hunting through components.
 *  3. Operational switches for AI search (§5.6), which must be flippable without a
 *     deployment when the provider is down or the spend cap is reached.
 *
 * Deliberately a singleton: a settings collection with many rows invites "which one
 * is live?" bugs. Read it through Settings.get().
 */

/** Opening hours for one day. Closed days simply omit the times. */
const officeHoursSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      required: true,
    },
    opensAt: { type: String, trim: true }, // "09:00"
    closesAt: { type: String, trim: true }, // "17:00"
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    // Fixed discriminator that makes the singleton enforceable with a unique index.
    key: {
      type: String,
      default: "site",
      immutable: true,
    },

    // --- Agency identity ---------------------------------------------------------

    agencyName: {
      type: String,
      required: [true, "Agency name is required"],
      trim: true,
    },

    tagline: { type: String, trim: true },

    /**
     * LASRERA registration number (§11).
     *
     * The client's obligation to hold, but displayed on the site: Lagos has stated
     * unregistered practice is an offence, and the number functions as a trust signal.
     */
    lasreraNumber: { type: String, trim: true },

    // Other professional body registrations shown in the footer/about page.
    registrationNumbers: {
      type: [{ body: String, number: String }],
      default: [],
    },

    // --- Contact -----------------------------------------------------------------

    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },

    // Drives the site-wide click-to-chat links (§10.1).
    whatsapp: { type: String, trim: true },

    address: { type: String, trim: true },

    // Office pin for the contact page map.
    coordinates: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
    },

    officeHours: { type: [officeHoursSchema], default: [] },

    socialLinks: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      x: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      youtube: { type: String, trim: true },
      tiktok: { type: String, trim: true },
    },

    // --- Theme (§9) --------------------------------------------------------------

    /**
     * Brand values, kept in exactly one place.
     *
     * Colours are emitted as CSS custom properties; **no component may hardcode a
     * brand colour, font or logo**. This is what makes the copy-and-rebrand step for
     * a new client fast instead of archaeological.
     */
    theme: {
      // Applied as CSS custom properties at the document root.
      colors: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      fontHeading: { type: String, trim: true },
      fontBody: { type: String, trim: true },
      logoUrl: { type: String, trim: true },
      logoDarkUrl: { type: String, trim: true },
      faviconUrl: { type: String, trim: true },

      // Which of the 2–3 homepage layout variants this client uses (§9) — chosen at
      // build time for a client copy, stored so it survives a reseed.
      homepageVariant: {
        type: String,
        default: "default",
        trim: true,
      },
    },

    // Footer copy and copyright line — content, not code.
    footerText: { type: String, trim: true },

    // --- AI search operational controls (§5.6) -----------------------------------

    aiSearch: {
      /**
       * Kill switch. When false the phrase box falls back to the ordinary filter UI,
       * which stays fully functional at all times — AI search is an additional entry
       * point, never the only one.
       */
      enabled: { type: Boolean, default: false },

      // Hard monthly spend cap in USD. Reaching it must disable the feature rather
      // than run up an uncapped bill on a public endpoint.
      monthlySpendCapUsd: { type: Number, default: 0 },

      // Running spend for the current period, reset by the billing-period job.
      currentSpendUsd: { type: Number, default: 0 },

      // Request budget before falling back to filters (§5.6 two-second timeout).
      timeoutMs: { type: Number, default: 2000 },
    },

    // --- Compliance (§11) --------------------------------------------------------

    // Shown on every property page: the agency does not warrant title, and buyers
    // must conduct independent legal searches.
    listingDisclaimer: { type: String, trim: true },

    // NDPC registration reference, once the client has registered.
    ndpcRegistrationNumber: { type: String, trim: true },

    // --- Analytics ---------------------------------------------------------------

    googleAnalyticsId: { type: String, trim: true },
    googleSearchConsoleId: { type: String, trim: true },
  },
  { timestamps: true }
);

// Enforces the singleton — a second document cannot be inserted.
settingsSchema.index({ key: 1 }, { unique: true });

/**
 * Returns the settings document, creating it on first call.
 *
 * Takes: nothing.
 * Returns: a promise resolving to the Settings document.
 *
 * Every read goes through here so no caller has to know the singleton key, and a
 * fresh client copy works before anyone has visited the admin panel.
 */
settingsSchema.statics.get = async function () {
  const existing = await this.findOne({ key: "site" });
  if (existing) return existing;

  // Placeholder name so the required-field validation passes on a fresh install; the
  // seed script and the admin panel both overwrite it.
  return this.create({ key: "site", agencyName: "Untitled Agency" });
};

export default mongoose.model("Settings", settingsSchema);

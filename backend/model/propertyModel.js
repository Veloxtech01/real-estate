import mongoose from "mongoose";
import {
  LISTING_TYPES,
  LISTING_STATUSES,
  PUBLICATION_STATES,
  PROPERTY_TYPES,
  TITLE_TYPES,
  RENT_PERIODS,
  CHARGE_PERIODS,
  CURRENCIES,
  POWER_SOURCES,
  WATER_SOURCES,
  METERING_TYPES,
  FLOOD_RISK_LEVELS,
  ROAD_CONDITIONS,
  getStateRentRules,
} from "../utils/constants.js";

/**
 * Rent terms (§8.2).
 *
 * A single price field is insufficient for Nigerian lettings: what a tenant actually
 * pays on day one is rent + agency fee + legal fee + caution deposit + service
 * charge, and rent is quoted per annum. Storing only "price" would misrepresent the
 * cost and, worse, let the site publish terms that breach Lagos law.
 */
const rentSchema = new mongoose.Schema(
  {
    // Headline rent figure, in the listing's currency.
    amount: { type: Number, min: [0, "Rent cannot be negative"] },

    // Per annum is the Nigerian norm — deliberately the default, not per month.
    period: { type: String, enum: RENT_PERIODS, default: "per_annum" },

    // Years of rent demanded up front. Capped per state at validation time.
    advanceYears: {
      type: Number,
      min: [0, "Advance years cannot be negative"],
      default: 1,
    },

    // Agency commission as a percentage. Lagos caps this at 10% (§8.2).
    agencyFeePct: {
      type: Number,
      min: [0, "Agency fee cannot be negative"],
      max: [100, "Agency fee cannot exceed 100%"],
    },

    // Legal/agreement fee as a percentage, quoted separately from agency commission.
    legalFeePct: {
      type: Number,
      min: [0, "Legal fee cannot be negative"],
      max: [100, "Legal fee cannot exceed 100%"],
    },

    // Refundable damage deposit.
    cautionDeposit: { type: Number, min: 0 },

    // Estate/building service charge — billed on its own cycle, hence the separate
    // period field rather than reusing the rent period.
    serviceCharge: { type: Number, min: 0 },
    serviceChargePeriod: { type: String, enum: CHARGE_PERIODS },
  },
  { _id: false }
);

/**
 * Land title and survey status (§8.2).
 *
 * Named `landTitle` on the property rather than `title`, which is the listing
 * headline. Nigerian buyers filter on this before anything else, so it is an
 * enumerated field, never free text.
 */
const landTitleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TITLE_TYPES },

    // Required when type is "excision" or "gazette" — enforced in pre-validate below.
    gazetteNumber: { type: String, trim: true },

    // The single most-asked question on Lagos land after title itself.
    freeFromGovernmentAcquisition: { type: Boolean, default: false },

    surveyPlanAvailable: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Infrastructure (§8.2) — power, water, metering, flood, road, estate.
 *
 * These are functional filters in this market, not nice-to-have detail: a listing
 * without stated power arrangements is not comparable to one with 24-hour estate
 * supply, and flood history genuinely differentiates properties in Lekki and Ajah.
 */
const infrastructureSchema = new mongoose.Schema(
  {
    // Multiple sources are normal — grid band plus a generator plus an inverter.
    power: [{ type: String, enum: POWER_SOURCES }],
    water: [{ type: String, enum: WATER_SOURCES }],

    metering: { type: String, enum: METERING_TYPES },

    floodRisk: { type: String, enum: FLOOD_RISK_LEVELS },

    // Distinct from risk level: risk is an assessment, this is a fact of record.
    hasFloodHistory: { type: Boolean, default: false },

    roadCondition: { type: String, enum: ROAD_CONDITIONS },

    // Distance to the nearest tarred road, in metres. Matters where the last
    // kilometre is untarred and impassable in the rains.
    distanceToTarredRoadM: { type: Number, min: 0 },

    isGatedEstate: { type: Boolean, default: false },
    estateName: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Property — the core listing record.
 *
 * Everything the public search, the detail page, and the agency's admin panel work
 * against. Field choices follow scope doc §8.2 closely; where a generic template
 * would use one field (price, "legal status", "amenities"), this uses the shape the
 * Nigerian market actually filters on.
 */
const propertySchema = new mongoose.Schema(
  {
    // --- Identity & marketing ---------------------------------------------------

    // Human-quoted reference, e.g. "REF1042" — appears in the SEO URL and is what
    // staff and clients say on the phone.
    reference: {
      type: String,
      required: [true, "Reference is required"],
      trim: true,
      uppercase: true,
    },

    // Listing headline, e.g. "4 Bedroom Duplex in Lekki Phase 1".
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    // Full SEO URL segment including the reference (§4.1), e.g.
    // "4-bedroom-duplex-lekki-phase-1-REF1042".
    slug: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    listingType: {
      type: String,
      enum: { values: LISTING_TYPES, message: "{VALUE} is not a valid listing type" },
      required: [true, "Listing type is required"],
    },

    propertyType: {
      type: String,
      enum: { values: PROPERTY_TYPES, message: "{VALUE} is not a valid property type" },
      required: [true, "Property type is required"],
    },

    // Commercial lifecycle — distinct from publication state, since a sold property
    // may stay published for SEO value.
    status: {
      type: String,
      enum: LISTING_STATUSES,
      default: "available",
    },

    publicationState: {
      type: String,
      enum: PUBLICATION_STATES,
      default: "draft",
    },

    // Soft delete (§4.2). Nulled rather than removed so enquiries and viewings that
    // reference this listing keep resolving.
    deletedAt: {
      type: Date,
      default: null,
    },

    // Homepage placement — an admin toggle, explicitly not a paid boost (§4.2).
    isFeatured: {
      type: Boolean,
      default: false,
    },

    // --- Assignment -------------------------------------------------------------

    // The agent enquiries about this property are routed to (§4.3).
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: [true, "A listing must be assigned to an agent"],
    },

    // --- Location ---------------------------------------------------------------

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: [true, "Location is required"],
    },

    // Denormalised from the location so rent-rule validation and state filtering
    // don't need a populate on every write.
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },

    /**
     * Required local reference, e.g. "opposite Shoprite, Circle Mall".
     *
     * Required because Nigerian addresses geocode unreliably and many properties have
     * no formal address — directions are given by landmark (§10.2). Without this the
     * listing is effectively unfindable on the ground.
     */
    landmark: {
      type: String,
      required: [true, "A landmark is required — many properties have no formal address"],
      trim: true,
    },

    // Street address where one exists. Optional by design, unlike landmark.
    address: {
      type: String,
      trim: true,
    },

    /**
     * The pin the agent drops at listing time (§10.2). Search is never built on a
     * geocoder here; this is display and Phase 2 map search only.
     */
    coordinates: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
    },

    // --- Specification ----------------------------------------------------------

    bedrooms: { type: Number, min: 0 },

    // Bathrooms and toilets are separate counts, because Nigerian listings quote both
    // and they are genuinely different numbers (§8.2, retained from the brief).
    bathrooms: { type: Number, min: 0 },
    toilets: { type: Number, min: 0 },

    // Boys' Quarters — a real, filtered-on feature in this market (§8.2).
    boysQuarters: { type: Number, min: 0, default: 0 },

    parkingSpaces: { type: Number, min: 0 },

    /**
     * Land area in square metres — the canonical unit (§8.2).
     *
     * Never store plots: a "plot" is ~648 sqm generally but ~464 sqm in parts of
     * Lagos, so the same number would mean different areas by location. Convert at
     * input and display time with toSquareMetres() in utils/constants.js.
     */
    landSizeSqm: { type: Number, min: 0 },

    // Covered floor area, where quoted.
    builtAreaSqm: { type: Number, min: 0 },

    yearBuilt: { type: Number, min: 1800 },

    // --- Pricing ----------------------------------------------------------------

    price: {
      // Absent when priceOnRequest is true — that is a genuine state, not a zero.
      amount: { type: Number, min: [0, "Price cannot be negative"] },

      // Stored per listing: high-end Lagos and Abuja stock is often quoted in USD
      // (§8.2). Never assume naira.
      currency: { type: String, enum: CURRENCIES, default: "NGN" },

      // Both are real states that sorting and filtering must handle deliberately,
      // rather than treating a missing price as 0 and sorting it to the top.
      isNegotiable: { type: Boolean, default: false },
      onRequest: { type: Boolean, default: false },
    },

    // Only meaningful when listingType is "rent"; enforced in pre-validate.
    rent: { type: rentSchema, default: undefined },

    // --- Title, infrastructure, tags --------------------------------------------

    landTitle: { type: landTitleSchema, default: undefined },

    infrastructure: { type: infrastructureSchema, default: undefined },

    // The single collapsed taxonomy replacing amenities/facilities/features/security
    // (§8.1). Validated against the Taxonomy collection, which is also the AI-search
    // whitelist.
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Taxonomy",
      },
    ],

    // --- Media ------------------------------------------------------------------

    // Cover image chosen by an admin (§4.2). Full gallery lives in PropertyMedia so
    // ordering and per-image metadata don't bloat this document.
    coverImage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyMedia",
    },

    floorPlan: { type: String, trim: true },

    /**
     * Private property documents — title scans, surveys.
     *
     * §8.1 makes these an access-controlled field rather than a public collection.
     * select:false means they never appear in an ordinary query result, so a public
     * listings endpoint cannot leak them by forgetting to project them away.
     */
    documents: {
      type: [
        {
          label: { type: String, trim: true },
          url: { type: String, trim: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      select: false,
      default: [],
    },

    // --- SEO & analytics --------------------------------------------------------

    // Per-listing overrides; generated from the title/location when empty (§4.4).
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },

    // Drives the Phase 2 agent dashboard's view counts. Incremented out-of-band, not
    // on every render, to avoid a write per page view.
    viewCount: { type: Number, default: 0 },

    // Set when publicationState first becomes "published" — "recent listings" should
    // order by this, not createdAt, which would surface long-drafted listings as new.
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

// --- Indexes ------------------------------------------------------------------

// The SEO URL lookup — every property detail page hit goes through this.
propertySchema.index({ slug: 1 }, { unique: true });

// Staff and clients quote references; also prevents duplicate reference entry.
propertySchema.index({ reference: 1 }, { unique: true });

// The main search path: public listings filtered by type/status, then location and
// price. Ordered with the always-present equality fields first so the index is
// usable regardless of which optional filters a visitor applies.
propertySchema.index({
  publicationState: 1,
  deletedAt: 1,
  listingType: 1,
  location: 1,
  "price.amount": 1,
});

// Bedroom/property-type filtering within a location — the second most common
// combination in the filter panel (§4.1).
propertySchema.index({ location: 1, propertyType: 1, bedrooms: 1 });

// Homepage featured rail and "recent listings".
propertySchema.index({ isFeatured: 1, publishedAt: -1 });

// Agent profile pages list that agent's properties (§4.1).
propertySchema.index({ agent: 1, publicationState: 1 });

// Full-text search over the free-text fields. §10.1 rules out a separate search
// engine at this scale — database full-text plus the indexed filters above is enough
// for a few hundred listings.
propertySchema.index(
  { title: "text", description: "text", landmark: "text" },
  { weights: { title: 10, landmark: 5, description: 1 }, name: "property_text" }
);

// Geospatial index for Phase 2 map search. Sparse because coordinates are optional —
// a listing can go live before the agent drops the pin.
propertySchema.index({ coordinates: "2dsphere" }, { sparse: true });

// --- Validation ---------------------------------------------------------------

/**
 * Cross-field validation that a per-field validator can't express.
 *
 * Mongoose 9 pre-middleware is async with no next() callback.
 */
propertySchema.pre("validate", async function () {
  // A rental with no rent terms would render a price-less listing; a sale carrying
  // rent terms is a data-entry error that would show letting fees on a sale page.
  if (this.listingType === "rent") {
    if (!this.rent || this.rent.amount == null) {
      this.invalidate("rent.amount", "Rent amount is required for a rental listing");
    }
  } else if (this.rent) {
    this.invalidate("rent", "Rent terms are only valid on a rental listing");
  }

  // "Price on request" is a genuine state (§8.2) — but if it isn't set, a sale needs
  // an actual figure, otherwise the listing sorts and filters unpredictably.
  if (this.listingType === "sale" && !this.price?.onRequest && this.price?.amount == null) {
    this.invalidate(
      "price.amount",
      "Price is required unless the listing is marked price-on-request"
    );
  }

  // An excision or gazette title is meaningless without its gazette number — that
  // number is precisely what a buyer's lawyer searches against.
  if (
    this.landTitle?.type &&
    ["excision", "gazette"].includes(this.landTitle.type) &&
    !this.landTitle.gazetteNumber
  ) {
    this.invalidate(
      "landTitle.gazetteNumber",
      "A gazette number is required for excision or gazette title"
    );
  }

  /**
   * Statutory rent limits, driven by a per-state table (§8.2 "Lagos compliance").
   *
   * Enforced at write time rather than at display time: with a single price field
   * the original design could publish terms breaching Lagos's 10% agency-fee cap and
   * one-year advance limit, which is a legal exposure for the client, not a
   * presentation bug.
   */
  if (this.listingType === "rent" && this.rent) {
    const rules = getStateRentRules(this.state);

    if (this.rent.agencyFeePct != null && this.rent.agencyFeePct > rules.maxAgencyFeePct) {
      this.invalidate(
        "rent.agencyFeePct",
        `Agency fee cannot exceed ${rules.maxAgencyFeePct}% in ${this.state}`
      );
    }

    if (this.rent.advanceYears != null && this.rent.advanceYears > rules.maxAdvanceYears) {
      this.invalidate(
        "rent.advanceYears",
        `Advance rent cannot exceed ${rules.maxAdvanceYears} year(s) in ${this.state}`
      );
    }
  }
});

/**
 * Stamps publishedAt the first time a listing goes live.
 *
 * Guarded so re-publishing after an edit doesn't reset it and push an old listing
 * back to the top of "recent listings".
 */
propertySchema.pre("save", async function () {
  if (this.isModified("publicationState") && this.publicationState === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

export default mongoose.model("Property", propertySchema);

import { readFile } from "node:fs/promises";

import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";
import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import Taxonomy from "../model/taxonomyModel.js";
import logger from "../utils/logger.js";
import { toSquareMetres } from "../utils/constants.js";
import { slugify, propertySlug } from "../utils/slugify.js";
import { galleryFor } from "./demoGallery.js";

/**
 * Imports the sample Nigerian listings JSON into the property collection.
 *
 * **Development data only.** A real client copy must not run this — it would ship
 * 200 invented properties. The seed script requires an explicit --demo flag for
 * exactly that reason.
 */

/**
 * Maps the sample data's free-text property types onto the canonical enum.
 *
 * The source data mixes structure and form ("Detached Duplex", "Terrace Duplex"),
 * whereas the schema enumerates the form. "Mansion" has no enum member — it is a
 * marketing word, not a property type — so it maps to detached.
 */
const PROPERTY_TYPE_MAP = {
  Apartment: "apartment",
  Bungalow: "bungalow",
  "Detached Duplex": "detached",
  "Semi-Detached Duplex": "semi_detached",
  "Terrace Duplex": "terrace",
  Penthouse: "penthouse",
  Mansion: "detached",
};

/**
 * Maps sample feature strings onto seeded taxonomy keys.
 *
 * Note "BQ" and "Boys Quarters" both appear in the source and mean the same thing —
 * they set the property's boysQuarters count rather than becoming a tag, since the
 * schema models that as a number.
 */
const FEATURE_TO_TAXONOMY = {
  "Swimming Pool": "swimming_pool",
  Garden: "garden",
  "Parking Space": "parking",
  "Air Conditioning": "air_conditioning",
  "Fitted Kitchen": "fitted_kitchen",
  "Walk-in Closet": "walk_in_closet",
  Generator: "generator",
  "Water Supply": "water_supply",
  "Serviced Estate": "serviced",
  "Gated Estate": "gated_estate",
  "24 Hours Security": "security_24_7",
  CCTV: "cctv",
  "Electric Fence": "electric_fence",
};

/** Feature strings that indicate a Boys' Quarters rather than a tag. */
const BQ_FEATURES = new Set(["BQ", "Boys Quarters"]);

/**
 * Parses the sample data's land size string, e.g. "500 sqm".
 *
 * Takes: raw (string | undefined).
 * Returns: the area in square metres, or undefined when unparseable — an unparsed
 *          size is dropped rather than guessed, since a wrong plot size misstates
 *          the property.
 */
function parseLandSize(raw) {
  if (!raw) return undefined;

  const match = /^([\d.]+)\s*(\w+)$/.exec(raw.trim());
  if (!match) return undefined;

  const [, value, unit] = match;

  try {
    return toSquareMetres(Number(value), unit.toLowerCase());
  } catch {
    // Unknown unit — better to store nothing than to store a wrong area.
    return undefined;
  }
}

/**
 * Creates the agency's staff accounts from the sample data's agent names.
 *
 * The sample data is marketplace-shaped: 153 different agents across many different
 * companies. This project is a single agency (§1), so only a handful of names are
 * kept as staff and their `company` field is discarded — importing them all would
 * model a business this site deliberately isn't.
 *
 * Takes: records (array) — the parsed sample data; staffCount (number).
 * Returns: a promise resolving to the created Agent documents.
 */
async function createStaffFromSample(records, staffCount, password) {
  const seen = new Map();

  for (const record of records) {
    if (seen.size >= staffCount) break;
    const { name, phone } = record.agent ?? {};
    if (!name || seen.has(name)) continue;
    seen.set(name, phone);
  }

  const agents = [];
  for (const [name, phone] of seen) {
    const slug = slugify(name);
    agents.push({
      name,
      slug,
      // Example.com addresses — these are demo accounts, not real staff.
      email: `${slug}@example.com`,
      password,
      phone,
      whatsapp: phone,
      role: "agent",
      position: "Sales Consultant",
      isActive: true,
      isPublic: true,
    });
  }

  // create() rather than insertMany() so the password-hashing pre-save hook runs.
  return Agent.create(agents);
}

/**
 * Imports the sample listings.
 *
 * Takes: options — { filePath, staffCount, demoPassword }.
 * Returns: a promise resolving to { properties, media, agents } counts.
 */
export async function importDemoListings({ filePath, staffCount = 8, demoPassword }) {
  const raw = await readFile(filePath, "utf8");
  const records = JSON.parse(raw);

  logger.info(`Importing ${records.length} sample listings from ${filePath}`);

  const agents = await createStaffFromSample(records, staffCount, demoPassword);

  // Resolve the seeded reference data once, rather than per listing.
  const locations = await Location.find({});
  const locationByName = new Map(locations.map((l) => [l.name.toLowerCase(), l]));

  const taxonomy = await Taxonomy.find({});
  const taxonomyByKey = new Map(taxonomy.map((t) => [t.key, t._id]));

  const properties = [];
  let skipped = 0;

  for (const record of records) {
    const location = locationByName.get(record.location?.area?.toLowerCase());

    // A listing whose area was never seeded has no canonical location to attach to.
    // Skipping is correct: inventing a Location here would pollute the very
    // whitelist the AI search validates against (§5.2).
    if (!location) {
      skipped += 1;
      continue;
    }

    const isRent = record.purpose === "For Rent";
    const reference = `REF${1000 + record.id}`;

    // Features split three ways: BQ becomes a count, estate/utility features set
    // infrastructure flags, and the rest become taxonomy tags.
    const features = record.features ?? [];
    const tags = features
      .map((feature) => taxonomyByKey.get(FEATURE_TO_TAXONOMY[feature]))
      .filter(Boolean);

    const infrastructure = {
      power: features.includes("Generator") ? ["generator"] : [],
      water: features.includes("Water Supply") ? ["public_supply"] : [],
      isGatedEstate: features.includes("Gated Estate") || features.includes("Serviced Estate"),
    };

    const property = {
      reference,
      title: record.title,
      slug: propertySlug(record.title, reference),
      description: record.description,
      listingType: isRent ? "rent" : "sale",
      propertyType: PROPERTY_TYPE_MAP[record.type] ?? "apartment",
      status: "available",
      publicationState: "published",
      publishedAt: record.createdAt ? new Date(record.createdAt) : new Date(),
      isFeatured: Boolean(record.featured),

      // Round-robin assignment across the demo staff — the sample's own agent
      // records belong to other companies and are not used.
      agent: agents[record.id % agents.length]._id,

      location: location._id,
      state: location.state,

      /**
       * The sample data has no landmark, but the schema requires one because
       * Nigerian addresses geocode unreliably (§10.2). Synthesised here so demo
       * data is valid — real listings must carry a genuine local reference.
       */
      landmark: `Near ${record.location.area}, ${record.location.city}`,

      bedrooms: record.bedrooms,
      bathrooms: record.bathrooms,
      toilets: record.toilets,
      parkingSpaces: record.parkingSpaces,
      boysQuarters: features.some((f) => BQ_FEATURES.has(f)) ? 1 : 0,
      landSizeSqm: parseLandSize(record.landSize),

      tags,
      infrastructure,
    };

    if (isRent) {
      // priceDisplay in the sample reads "₦1,150,000/year", so the figure is annual —
      // which is the Nigerian norm and the schema default.
      property.rent = { amount: record.price, period: "per_annum" };
    } else {
      property.price = { amount: record.price, currency: record.currency || "NGN" };
    }

    properties.push(property);
  }

  // insertMany is safe here: Property has no save hooks that matter for already-
  // published demo data, and 200 individual saves would be needlessly slow.
  const created = await Property.insertMany(properties, { ordered: false });

  // Build the gallery documents, then point each property at its cover image.
  //
  // Photos come from the committed Pexels catalogue rather than the source JSON,
  // whose `images` field is a set of grey placehold.co stubs — real photography is
  // the whole visual impression the demo site makes. The selection is seeded by the
  // listing reference, so re-seeding reproduces the same gallery and the diff stays
  // readable.
  const mediaDocs = [];
  for (const property of created) {
    const gallery = galleryFor(property.reference, property.propertyType, property.title);

    gallery.forEach((image, index) => {
      mediaDocs.push({
        property: property._id,
        url: image.url,
        // Placeholder ids — real uploads get these from Cloudinary (§10.1). Keeping
        // the "demo/" prefix is what lets a real asset be told from a seeded one.
        publicId: `demo/${property.reference}/${index + 1}`,
        // The catalogue's own smaller variant, not a copy of the full-size url —
        // pointing both at the same file defeats the point of a thumbnail.
        thumbnailUrl: image.thumbnailUrl,
        type: "image",
        // Composed in demoGallery.js, not re-derived here, so the two cannot drift.
        alt: image.alt,
        // Real dimensions, so next/image reserves the right space and the results
        // grid does not reflow as photos arrive.
        width: image.width,
        height: image.height,
        displayOrder: index,
      });
    });
  }

  const media = await PropertyMedia.insertMany(mediaDocs, { ordered: false });

  // Cover image = the first image of each listing (§4.2 lets an admin change it).
  const coverByProperty = new Map();
  for (const item of media) {
    if (item.displayOrder === 0) coverByProperty.set(String(item.property), item._id);
  }

  await Promise.all(
    created.map((property) =>
      Property.updateOne(
        { _id: property._id },
        { $set: { coverImage: coverByProperty.get(String(property._id)) } }
      )
    )
  );

  if (skipped > 0) {
    logger.warn(`Skipped ${skipped} listings with no matching seeded location`);
  }

  return { properties: created.length, media: media.length, agents: agents.length };
}

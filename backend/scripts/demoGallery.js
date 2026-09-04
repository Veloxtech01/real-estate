import { DEMO_IMAGES } from "./demoImages.js";

/**
 * Picks each demo listing's gallery from the generated photo catalogue.
 *
 * Hand-written and deliberately separate from demoImages.js: the generator
 * (fetchDemoImages.js) overwrites that file wholesale, so any logic living there
 * would be destroyed on the next refresh.
 */

/** How many photos each demo listing gets. */
const GALLERY_SIZE = 3;

/**
 * Maps a property type onto the three catalogue categories its gallery draws from.
 *
 * Residential listings lead with an exterior because displayOrder 0 becomes the cover
 * image — a card fronted by a bathroom reads as a mistake.
 *
 * Takes: propertyType (string) — a PROPERTY_TYPES member.
 * Returns: an array of exactly three category names.
 */
export function categoriesFor(propertyType) {
  if (propertyType === "land") return ["land", "land", "land"];
  if (propertyType === "commercial") {
    return ["commercial", "commercial", "commercial"];
  }

  // The default arm, not an enumerated list: a property type added to constants.js
  // later must still get a valid triple rather than undefined.
  return ["exterior", "interior", "interior"];
}

/**
 * Hashes a string to a non-negative integer (FNV-1a, 32-bit).
 *
 * Deliberately not Math.random() or anything time-based: re-seeding must reproduce
 * the identical gallery, or every diff of the demo data churns for no reason.
 *
 * Takes: value (string).
 * Returns: a non-negative integer.
 */
function hash(value) {
  let result = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    // The FNV prime, applied with shifts to stay inside 32 bits without BigInt.
    result +=
      (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24);
  }

  return result >>> 0;
}

/**
 * Builds one listing's gallery.
 *
 * Takes: reference (string) — the listing's REF code, used as the seed;
 *        propertyType (string); title (string) — the listing title, composed into
 *        each image's alt text.
 * Returns: an array of three fresh image objects
 *          { url, thumbnailUrl, width, height, alt, photographer, sourceUrl }.
 */
export function galleryFor(reference, propertyType, title) {
  const categories = categoriesFor(propertyType);
  const start = hash(reference);

  return categories.map((category, index) => {
    const items = DEMO_IMAGES[category];
    // Stepping forward from one shared start index — rather than hashing three times
    // — is what guarantees no repeat when all three categories are the same array.
    const item = items[(start + index) % items.length];

    return {
      // A fresh object per listing: 200 listings sharing one object is a trap
      // waiting for the first `.alt =`.
      ...item,
      // The title alone does not describe the picture; the catalogue alt alone does
      // not identify the listing. Screen readers and image search need both.
      alt: `${title} — ${item.alt}`,
    };
  });
}

export { GALLERY_SIZE };

import { formatMoney, formatRentPeriod } from "@/lib/format";

/**
 * Guards around the property shape returned by the API.
 *
 * Every rule here exists because the raw shape has a trap in it (see the "Gotchas"
 * section of docs/API-REFERENCE.md). Components must go through these helpers rather
 * than reading `property.price` and friends directly.
 */

// Status key -> label + tone. Tone maps to a colour token; the label always renders,
// so status is never communicated by colour alone.
const STATUS = {
  available: { label: "Available", tone: "success" },
  under_offer: { label: "Under offer", tone: "warning" },
  sold: { label: "Sold", tone: "danger" },
  rented: { label: "Rented", tone: "danger" },
  off_market: { label: "Off market", tone: "muted" },
};

const PLACEHOLDER_IMAGE = "/placeholder-property.svg";

/** True when the listing is a letting. Reads listingType — the authoritative field. */
export function isRental(property) {
  return property?.listingType === "rent";
}

/**
 * Resolve what to display where the price goes.
 *
 * The trap: `price` is ALWAYS a truthy object because of schema defaults, even on a
 * rental where the figure lives on `rent.amount`. `if (property.price)` therefore
 * always passes and renders nothing useful. We check `amount != null` instead.
 *
 * @returns {{label: string, suffix: string|null, isOnRequest: boolean, isNegotiable: boolean}}
 */
export function priceOf(property) {
  const rental = isRental(property);
  const source = rental ? property?.rent : property?.price;
  const currency = property?.price?.currency ?? "NGN";
  const isNegotiable = Boolean(property?.price?.isNegotiable);
  const explicitlyOnRequest = Boolean(property?.price?.onRequest);

  // A published listing with no figure at all is a legitimate state (§8.2), not
  // missing data — say so rather than rendering ₦0 or hiding the listing.
  if (explicitlyOnRequest || source?.amount == null) {
    return { label: "Price on request", suffix: null, isOnRequest: true, isNegotiable };
  }

  return {
    label: formatMoney(source.amount, currency),
    // Rent is per annum by default. Always stating the period stops a reader
    // assuming monthly and undercounting the rent by twelve times.
    suffix: rental ? formatRentPeriod(source.period ?? "per_annum") : null,
    isOnRequest: false,
    isNegotiable,
  };
}

/**
 * Resolve the card/hero image. `coverImage` and its `alt`/`blurDataUrl`/dimensions are
 * frequently absent on real data, so every consumer would otherwise need the same
 * guard. A designed placeholder beats a broken frame.
 */
export function coverImageOf(property) {
  const cover = property?.coverImage;
  if (!cover?.url) {
    return { url: PLACEHOLDER_IMAGE, alt: property?.title ?? "Property", isPlaceholder: true };
  }
  return {
    url: cover.url,
    // Fall back to the listing title so a meaningful image is never left unlabelled.
    alt: cover.alt || property?.title || "Property",
    isPlaceholder: false,
  };
}

/** Label + tone for a listing status. Unknown statuses degrade to a muted label. */
export function statusLabel(status) {
  return STATUS[status] ?? { label: "Unavailable", tone: "muted" };
}

/** The SEO listing URL. The slug is built by the API — never re-derive it here. */
export function propertyPath(property) {
  return `/property/${property.slug}`;
}

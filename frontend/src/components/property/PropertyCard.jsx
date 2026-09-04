import Image from "next/image";
import Link from "next/link";
import { FiMapPin } from "react-icons/fi";
import Badge from "@/components/ui/Badge";
import { priceOf, coverImageOf, statusLabel, propertyPath } from "@/lib/property";
import { formatArea, humanise } from "@/lib/format";

/**
 * The single listing representation, used by the featured rail, the results grid and
 * the "similar listings" strip. Takes the API card object verbatim and never fetches.
 *
 * @param {object} property  A property card object from the API.
 * @param {boolean} priority Set on above-the-fold cards so next/image preloads them.
 */
export default function PropertyCard({ property, priority = false }) {
  const price = priceOf(property);
  const cover = coverImageOf(property);
  const status = statusLabel(property.status);
  const area = formatArea(property.landSizeSqm);

  // Land and commercial stock has no bedroom count; rendering "0 bed" looks broken.
  const showRooms = property.bedrooms > 0;

  return (
    // Hover lifts the card with a shadow, not a transform: `scale` on a grid child
    // shifts its neighbours, which the design system rules out.
    <Link
      href={propertyPath(property)}
      className="group block overflow-hidden rounded-lg border border-border bg-surface-raised transition-[border-color,box-shadow] duration-200 hover:border-accent hover:shadow-xl hover:shadow-ink/10"
    >
      {/* Image region — fixed 4/3 ratio reserves space so the grid never reflows. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink/5">
        <Image
          src={cover.url}
          alt={cover.alt}
          fill
          // Tells the browser the real rendered width per breakpoint, so it does not
          // download a 1200px file for a 380px card.
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="object-cover"
        />
        {/* Status sits on the image; the label always renders, never colour alone. */}
        <div className="absolute left-3 top-3">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      {/* Content region */}
      <div className="p-5">
        <p className="mb-2 text-xs uppercase tracking-[0.08em] text-muted">
          {humanise(property.propertyType)} ·{" "}
          {property.listingType === "rent" ? "To let" : "For sale"}
        </p>

        <h3 className="line-clamp-2 text-lg text-ink transition-colors duration-200 group-hover:text-accent-text">
          {property.title}
        </h3>

        {/* Area line */}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
          <FiMapPin size={14} aria-hidden="true" />
          {property.location?.name}
          {property.location?.state ? `, ${property.location.state}` : ""}
        </p>

        {/* Spec row. Bathrooms and toilets are separate counts and both are shown. */}
        <div className="tabular mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {showRooms && <span>{property.bedrooms} bed</span>}
          {showRooms && <span>{property.bathrooms} bath</span>}
          {showRooms && (
            <span>
              {property.toilets} toilet{property.toilets === 1 ? "" : "s"}
            </span>
          )}
          {area && <span>{area}</span>}
        </div>

        {/* Price block */}
        {/* Gold hairline above the price rather than the neutral border — the price is
            the card's payload and the rule is what points at it. */}
        <div className="mt-5 flex items-baseline gap-2 border-t-2 border-accent/40 pt-4">
          <span className="tabular font-display text-xl text-ink">{price.label}</span>
          {/* Rent period is always stated — omitting it reads as a monthly figure. */}
          {price.suffix && <span className="text-sm text-muted">{price.suffix}</span>}
          {price.isNegotiable && (
            <Badge tone="accent" className="ml-auto">
              Negotiable
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

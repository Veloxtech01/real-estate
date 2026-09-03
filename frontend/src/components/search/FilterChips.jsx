import Link from "next/link";
import { FiX } from "react-icons/fi";
import { toQueryString, withFilter } from "@/lib/searchParams";
import { humanise, formatMoney } from "@/lib/format";

/**
 * Removable chips showing how the visitor's request was interpreted (scope §5.2 step 7).
 *
 * IMPORTANT: these render `applied` — what was ASKED FOR — never the relaxed search.
 * If the backend widened the search to find results, that is reported separately by
 * RelaxationNotice. Rewriting the chips to match a relaxed query would tell the visitor
 * they searched for something they did not.
 */

/**
 * Flatten the API's `applied` object into a list of removable chips.
 * Each chip knows which filter key it clears, so removal is a plain link.
 */
function buildChips(applied = {}) {
  const chips = [];

  if (applied.listingType) {
    chips.push({
      key: "listingType",
      label: applied.listingType === "rent" ? "To let" : "For sale",
    });
  }

  // propertyType comes back as an array even for a single selection.
  for (const type of applied.propertyType ?? []) {
    chips.push({ key: "propertyType", label: humanise(type) });
  }

  for (const location of applied.locations ?? []) {
    chips.push({ key: "location", label: location.name });
  }

  for (const amenity of applied.amenities ?? []) {
    chips.push({ key: "amenities", label: amenity.name });
  }

  if (applied.bedroomsMin) {
    chips.push({ key: "bedroomsMin", label: `${applied.bedroomsMin}+ bed` });
  }

  if (applied.priceMax) {
    chips.push({ key: "priceMax", label: `Under ${formatMoney(applied.priceMax, "NGN")}` });
  }

  if (applied.priceMin) {
    chips.push({ key: "priceMin", label: `Over ${formatMoney(applied.priceMin, "NGN")}` });
  }

  if (applied.titleType) {
    chips.push({ key: "titleType", label: humanise(applied.titleType) });
  }

  return chips;
}

export default function FilterChips({ applied, filters }) {
  const chips = buildChips(applied);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        // Removing a chip is a navigation, not client state — keeps the URL canonical.
        const next = toQueryString(withFilter(filters, chip.key, null));
        return (
          <Link
            key={`${chip.key}-${chip.label}`}
            href={`/properties${next ? `?${next}` : ""}`}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink-soft transition-colors duration-200 hover:border-accent hover:text-accent-text"
          >
            {chip.label}
            <FiX size={14} aria-hidden="true" />
            <span className="sr-only">Remove filter</span>
          </Link>
        );
      })}

      {/* Escape hatch back to an unfiltered search. */}
      <Link
        href="/properties"
        className="min-h-9 cursor-pointer px-2 py-1.5 text-sm text-muted underline underline-offset-4 transition-colors duration-200 hover:text-ink"
      >
        Clear all
      </Link>
    </div>
  );
}

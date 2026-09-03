"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiFilter, FiX } from "react-icons/fi";
import Button from "@/components/ui/Button";
import { toQueryString, withFilter } from "@/lib/searchParams";
import { humanise, formatMoney } from "@/lib/format";

/**
 * The filter rail. A client component because it handles input, but it holds no result
 * state and never fetches: every change builds a new URL and navigates, which re-runs
 * the server component that owns the data (spec §2.4).
 *
 * @param {object} options Payload from GET /api/filters — locations, types, taxonomy
 *   and the real price bounds computed from live stock.
 * @param {object} filters Current filter object parsed from the URL.
 */
export default function FilterPanel({ options, filters }) {
  const router = useRouter();
  // Mobile shows the rail as a sheet; desktop shows it inline.
  const [open, setOpen] = useState(false);

  /** Apply one filter change by navigating to the new URL. */
  const apply = (key, value) => {
    const query = toQueryString(withFilter(filters, key, value));
    router.push(`/properties${query ? `?${query}` : ""}`);
  };

  /** Toggle one amenity in or out of the multi-select array. */
  const toggleAmenity = (key) => {
    const current = filters.amenities ?? [];
    const next = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
    apply("amenities", next);
  };

  // Sale and rent prices differ by orders of magnitude, so the bound shown depends on
  // which listing type is selected — one shared slider would be useless for both.
  const priceBounds =
    filters.listingType === "rent" ? options?.priceRange?.rent : options?.priceRange?.sale;

  // Amenities are the "amenity" slice of the taxonomy; other categories are not
  // filterable in this slice.
  const amenities = (options?.taxonomy ?? []).filter((term) => term.category === "amenity");

  const panel = (
    <div className="space-y-8">
      {/* Listing type */}
      <fieldset>
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Listing type
        </legend>
        <div className="flex gap-2">
          {(options?.listingTypes ?? []).map((type) => {
            const active = filters.listingType === type;
            return (
              <button
                key={type}
                type="button"
                // Clicking the active option clears it — no separate "any" control.
                onClick={() => apply("listingType", active ? null : type)}
                aria-pressed={active}
                className={`min-h-11 flex-1 cursor-pointer rounded border px-3 text-sm transition-colors duration-200 ${
                  active
                    ? "border-accent bg-accent/10 text-accent-text"
                    : "border-border bg-surface-raised text-ink-soft hover:border-accent"
                }`}
              >
                {type === "rent" ? "To let" : "For sale"}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Property type */}
      <div>
        <label
          htmlFor="propertyType"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Property type
        </label>
        <select
          id="propertyType"
          value={filters.propertyType ?? ""}
          onChange={(event) => apply("propertyType", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Any type</option>
          {(options?.propertyTypes ?? []).map((type) => (
            // The API sends machine keys deliberately; labels are ours to decide.
            <option key={type} value={type}>
              {humanise(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label
          htmlFor="location"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Area
        </label>
        <select
          id="location"
          value={filters.location ?? ""}
          onChange={(event) => apply("location", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Anywhere</option>
          {(options?.locations ?? []).map((location) => (
            // Slug carries a state suffix because area names repeat across states.
            <option key={location._id} value={location.slug}>
              {location.name}, {location.state}
            </option>
          ))}
        </select>
      </div>

      {/* Bedrooms — a minimum, which is how people actually search. */}
      <div>
        <label
          htmlFor="bedroomsMin"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Bedrooms (minimum)
        </label>
        <select
          id="bedroomsMin"
          value={filters.bedroomsMin ?? ""}
          onChange={(event) => apply("bedroomsMin", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5, 6].map((count) => (
            <option key={count} value={count}>
              {count}+
            </option>
          ))}
        </select>
      </div>

      {/* Max price. Bounds come from live stock, so the ceiling is always reachable. */}
      {priceBounds && (
        <div>
          <label
            htmlFor="priceMax"
            className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
          >
            Maximum price
          </label>
          <select
            id="priceMax"
            value={filters.priceMax ?? ""}
            onChange={(event) => apply("priceMax", event.target.value || null)}
            className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
          >
            <option value="">No maximum</option>
            {/* Five evenly spaced steps across the real range beats an arbitrary list. */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((fraction) => {
              const value = Math.round(priceBounds.max * fraction);
              return (
                <option key={fraction} value={value}>
                  Under {formatMoney(value, "NGN")}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Land title — a Nigerian-market filter with real weight for buyers. */}
      <div>
        <label
          htmlFor="titleType"
          className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-muted"
        >
          Land title
        </label>
        <select
          id="titleType"
          value={filters.titleType ?? ""}
          onChange={(event) => apply("titleType", event.target.value || null)}
          className="min-h-11 w-full cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink"
        >
          <option value="">Any title</option>
          {(options?.titleTypes ?? []).map((type) => (
            <option key={type} value={type}>
              {humanise(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Amenities — multi-select, each rendered as a real checkbox with a label. */}
      {amenities.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">
            Amenities
          </legend>
          <div className="space-y-1">
            {amenities.map((term) => (
              <label
                key={term._id}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft"
              >
                <input
                  type="checkbox"
                  checked={(filters.amenities ?? []).includes(term.key)}
                  onChange={() => toggleAmenity(term.key)}
                  className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                />
                {term.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <FiFilter size={16} aria-hidden="true" />
          Filters
        </Button>
      </div>

      {/* Mobile sheet — full screen so the long list of controls is usable. */}
      {open && (
        <div
          className="fixed inset-0 overflow-y-auto bg-surface p-4 lg:hidden"
          style={{ zIndex: "var(--z-dropdown)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl text-ink">Filters</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
            >
              <FiX size={22} aria-hidden="true" />
            </button>
          </div>
          {panel}
          <div className="sticky bottom-0 mt-8 bg-surface py-4">
            <Button onClick={() => setOpen(false)} className="w-full">
              Show results
            </Button>
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <div className="hidden lg:block">{panel}</div>
    </>
  );
}

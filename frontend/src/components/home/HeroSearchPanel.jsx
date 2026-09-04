"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiMapPin, FiHome, FiTag, FiLayers } from "react-icons/fi";
import { humanise } from "@/lib/format";

/**
 * The structured search panel that straddles the hero's lower edge.
 *
 * Deliberately separate from the free-text SearchBar above it, not merged into one
 * form: /properties treats `q` and the structured filters as mutually exclusive — a
 * phrase goes to the natural-language endpoint and the filter params are ignored — so a
 * combined form would silently discard whichever half the visitor thought they set.
 * Two controls that each do one thing beats one control that quietly drops input.
 *
 * Like FilterPanel, this never fetches: it builds a URL and lets the server component
 * at /properties do the work.
 *
 * @param {object} options `GET /api/filters` — locations and propertyTypes come from
 *                         the API so the panel can never offer a value the DB lacks.
 */

// Bedroom options are a fixed ladder, not derived: the API takes a minimum, and
// "5+" is the top rung because stock above five is thin enough that an exact match
// would mostly return nothing.
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

// Shared field chrome. Navy inputs on a navy panel, separated by a light hairline.
const FIELD =
  "min-h-12 w-full cursor-pointer appearance-none rounded border border-white/15 bg-ink-raised pl-10 pr-8 text-sm text-white transition-colors duration-200 hover:border-accent/60";

export default function HeroSearchPanel({ options }) {
  const router = useRouter();

  // One piece of state per control. Empty string = "any", which is simply omitted
  // from the resulting query string rather than sent as a blank param.
  const [listingType, setListingType] = useState("");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedroomsMin, setBedroomsMin] = useState("");

  const locations = options?.locations ?? [];
  const propertyTypes = options?.propertyTypes ?? [];

  /**
   * Build the results URL from whichever controls were actually set.
   * Empty values are dropped so the URL stays readable and shareable.
   */
  const onSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (listingType) params.set("listingType", listingType);
    if (location) params.set("location", location);
    if (propertyType) params.set("propertyType", propertyType);
    if (bedroomsMin) params.set("bedroomsMin", bedroomsMin);

    const query = params.toString();
    router.push(query ? `/properties?${query}` : "/properties");
  };

  return (
    <form
      onSubmit={onSubmit}
      // `on-dark` switches the focus ring to brand gold across the panel.
      className="on-dark rounded-lg border border-white/10 bg-ink-deep/95 p-4 shadow-2xl backdrop-blur md:p-6"
      aria-label="Search by filter"
    >
      <div className="grid gap-4 lg:grid-cols-[repeat(4,1fr)_auto]">
        {/* Listing type — first because it changes what every other answer means. */}
        <div>
          <label
            htmlFor="hero-listing-type"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/60"
          >
            I want to
          </label>
          <div className="relative">
            <FiTag
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
              aria-hidden="true"
            />
            <select
              id="hero-listing-type"
              value={listingType}
              onChange={(event) => setListingType(event.target.value)}
              className={FIELD}
            >
              <option value="">Buy or rent</option>
              <option value="sale">Buy</option>
              <option value="rent">Rent</option>
            </select>
          </div>
        </div>

        {/* Area. Options carry the state so two same-named areas stay distinguishable. */}
        <div>
          <label
            htmlFor="hero-location"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/60"
          >
            Location
          </label>
          <div className="relative">
            <FiMapPin
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
              aria-hidden="true"
            />
            <select
              id="hero-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={FIELD}
            >
              <option value="">Any area</option>
              {locations.map((area) => (
                <option key={area._id} value={area.slug}>
                  {area.name}
                  {area.state ? `, ${area.state}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Property type. Labels are humanised here — the API sends machine keys only. */}
        <div>
          <label
            htmlFor="hero-property-type"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/60"
          >
            Property type
          </label>
          <div className="relative">
            <FiHome
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
              aria-hidden="true"
            />
            <select
              id="hero-property-type"
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              className={FIELD}
            >
              <option value="">Any type</option>
              {propertyTypes.map((type) => (
                <option key={type} value={type}>
                  {humanise(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bedrooms is a minimum, not an exact count — labelled so that is obvious. */}
        <div>
          <label
            htmlFor="hero-bedrooms"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/60"
          >
            Bedrooms
          </label>
          <div className="relative">
            <FiLayers
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
              aria-hidden="true"
            />
            <select
              id="hero-bedrooms"
              value={bedroomsMin}
              onChange={(event) => setBedroomsMin(event.target.value)}
              className={FIELD}
            >
              <option value="">Any</option>
              {BEDROOM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}+ bed
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit. Full width on small screens so it is never a cramped tap target. */}
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded bg-accent px-7 text-sm font-medium text-ink transition-colors duration-200 hover:bg-accent-hover lg:w-auto"
          >
            <FiSearch size={16} aria-hidden="true" />
            Search
          </button>
        </div>
      </div>
    </form>
  );
}

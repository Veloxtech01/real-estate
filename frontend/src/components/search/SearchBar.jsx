"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch } from "react-icons/fi";

/**
 * Free-text property search — the site's primary call to action.
 *
 * Submitting navigates to /properties?q=... and the server component there calls
 * POST /api/search. This works with AI switched off (the default): the backend's
 * deterministic parser handles prices, "to let", property types and place names, so
 * there is no client-side branch on whether AI is enabled.
 */
export default function SearchBar({ defaultValue = "" }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const onSubmit = (event) => {
    event.preventDefault();
    const query = value.trim();
    // An empty submit browses everything rather than erroring.
    router.push(query ? `/properties?q=${encodeURIComponent(query)}` : "/properties");
  };

  return (
    <form onSubmit={onSubmit} className="w-full">
      {/* Visually hidden label — the placeholder is a hint, not a label. */}
      <label htmlFor="property-search" className="sr-only">
        Search properties
      </label>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 px-2">
          <FiSearch size={20} className="shrink-0 text-muted" aria-hidden="true" />
          <input
            id="property-search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            // The API rejects a phrase over 500 characters; stop it at the input.
            maxLength={500}
            placeholder="3 bedroom flat in Lekki under 100m"
            className="min-h-11 w-full bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="min-h-12 cursor-pointer rounded bg-ink px-7 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink-soft"
        >
          Search
        </button>
      </div>
    </form>
  );
}

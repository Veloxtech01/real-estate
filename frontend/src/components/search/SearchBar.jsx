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

// Ground-dependent styling. The field sits on ivory on the results page and on navy in
// the hero; the two need different shells, and the gold submit is only legible on navy.
const TONES = {
  light: {
    shell: "border-border bg-surface-raised",
    icon: "text-muted",
    input: "text-ink placeholder:text-muted",
    submit: "bg-ink text-white hover:bg-ink-soft",
  },
  dark: {
    shell: "border-white/15 bg-ink-raised",
    icon: "text-accent",
    input: "text-white placeholder:text-white/50",
    submit: "bg-accent text-ink hover:bg-accent-hover",
  },
};

export default function SearchBar({ defaultValue = "", tone = "light" }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const t = TONES[tone] ?? TONES.light;

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

      <div
        className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center ${t.shell}`}
      >
        <div className="flex flex-1 items-center gap-3 px-2">
          <FiSearch size={20} className={`shrink-0 ${t.icon}`} aria-hidden="true" />
          <input
            id="property-search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            // The API rejects a phrase over 500 characters; stop it at the input.
            maxLength={500}
            placeholder="3 bedroom flat in Lekki under 100m"
            className={`min-h-11 w-full bg-transparent text-base focus:outline-none ${t.input}`}
          />
        </div>

        <button
          type="submit"
          className={`min-h-12 cursor-pointer rounded px-7 text-sm font-medium transition-colors duration-200 ${t.submit}`}
        >
          Search
        </button>
      </div>
    </form>
  );
}

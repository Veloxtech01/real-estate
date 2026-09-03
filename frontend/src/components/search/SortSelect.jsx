"use client";

import { useRouter } from "next/navigation";
import { toQueryString, withFilter } from "@/lib/searchParams";

/**
 * Sort control. A client component only because a <select> change must navigate;
 * the state itself still lives in the URL, not in React.
 */

// Values match what GET /api/properties accepts for `sort`.
const OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export default function SortSelect({ filters }) {
  const router = useRouter();

  const onChange = (event) => {
    // withFilter clears `page` too — page 3 of the old ordering is meaningless.
    const query = toQueryString(withFilter(filters, "sort", event.target.value));
    router.push(`/properties${query ? `?${query}` : ""}`);
  };

  return (
    <div className="flex items-center gap-2">
      {/* A real label, not a placeholder masquerading as one. */}
      <label htmlFor="sort" className="text-sm text-muted">
        Sort
      </label>
      <select
        id="sort"
        value={filters.sort ?? "newest"}
        onChange={onChange}
        className="min-h-11 cursor-pointer rounded border border-border bg-surface-raised px-3 text-sm text-ink transition-colors duration-200 hover:border-accent"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

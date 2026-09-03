import Container from "@/components/ui/Container";
import PropertyGrid from "@/components/property/PropertyGrid";
import FilterPanel from "@/components/search/FilterPanel";
import FilterChips from "@/components/search/FilterChips";
import RelaxationNotice from "@/components/search/RelaxationNotice";
import EmptyResults from "@/components/search/EmptyResults";
import Pagination from "@/components/search/Pagination";
import SortSelect from "@/components/search/SortSelect";
import SearchBar from "@/components/search/SearchBar";
import { getProperties, getFilters, naturalSearch } from "@/lib/api/server";
import { parseSearchParams } from "@/lib/searchParams";

// Search results must be server-rendered: organic search is the primary acquisition
// channel (scope §4.4), so the grid has to exist in the initial HTML.
export const metadata = {
  title: "Property search",
  description:
    "Search available homes, land and commercial property. Filter by area, type, price and bedrooms.",
};

/**
 * Property search results.
 *
 * All state lives in the URL. This component reads it, fetches on the server, and
 * renders. The filter panel never fetches — it pushes a new URL and this runs again.
 *
 * Next 16: `searchParams` is a Promise and must be awaited.
 */
export default async function PropertiesPage({ searchParams }) {
  const raw = await searchParams;
  const filters = parseSearchParams(raw);

  // Two entry points, one renderer: a free-text query goes through the natural-language
  // endpoint (which works with AI disabled), everything else through the filter query.
  // Both return the same envelope, so nothing downstream branches.
  const [results, filterOptions] = await Promise.all([
    filters.q
      ? naturalSearch({
          q: filters.q,
          page: filters.page ?? 1,
          limit: filters.limit ?? 12,
          sort: filters.sort ?? "newest",
        })
      : getProperties(filters),
    getFilters(),
  ]);

  const properties = results?.properties ?? [];
  const pagination = results?.pagination ?? { page: 1, pages: 1, total: 0 };

  return (
    <Container className="py-10 md:py-14">
      {/* Page heading + free-text search, so a visitor can restate their query here. */}
      <div className="max-w-3xl">
        <h1 className="text-3xl text-ink md:text-4xl">
          {filters.q ? `Results for “${filters.q}”` : "Property search"}
        </h1>
        <p className="tabular mt-3 text-ink-soft">
          {pagination.total} {pagination.total === 1 ? "listing" : "listings"}
        </p>
      </div>

      <div className="mt-8">
        <SearchBar defaultValue={filters.q ?? ""} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[18rem_1fr]">
        {/* Filter rail — a client component that only builds URLs. */}
        <aside>
          <FilterPanel options={filterOptions} filters={filters} />
        </aside>

        <div className="min-w-0 space-y-6">
          {/* Chips reflect what was asked for, never the relaxed search. */}
          <FilterChips applied={results?.applied ?? {}} filters={filters} />

          {/* Widened searches and unrecognised terms are always disclosed. */}
          <RelaxationNotice
            relaxed={results?.relaxed ?? []}
            unmatched={results?.unmatched ?? []}
          />

          <div className="flex items-center justify-end">
            <SortSelect filters={filters} />
          </div>

          {/* Results, or a route onward when there are none. */}
          {properties.length > 0 ? (
            <>
              <PropertyGrid properties={properties} />
              <div className="pt-6">
                <Pagination pagination={pagination} filters={filters} />
              </div>
            </>
          ) : (
            <EmptyResults />
          )}
        </div>
      </div>
    </Container>
  );
}

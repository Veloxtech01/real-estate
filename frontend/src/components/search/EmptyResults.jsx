import { FiSearch } from "react-icons/fi";
import Button from "@/components/ui/Button";

/**
 * Shown when a search returns nothing even after the backend's relaxation ladder.
 * Always offers a route onward — a bare "no results" page ends the visit.
 */
export default function EmptyResults() {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-6 py-16 text-center">
      <FiSearch size={32} className="mx-auto text-muted" aria-hidden="true" />
      <h2 className="mt-5 text-2xl text-ink">Nothing matched that search</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-ink-soft">
        Try removing a filter, widening the price range, or searching a broader area.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/properties">Browse all listings</Button>
        <Button href="/properties?listingType=rent" variant="secondary">
          See rentals
        </Button>
      </div>
    </div>
  );
}

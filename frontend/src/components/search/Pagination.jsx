import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { toQueryString } from "@/lib/searchParams";

/**
 * Page navigation for the results grid. Links rather than buttons, so each page has a
 * real crawlable URL and the back button behaves.
 *
 * @param {{page:number, pages:number, total:number}} pagination From the API.
 * @param {object} filters Current filter object, so page links preserve the search.
 */
export default function Pagination({ pagination, filters }) {
  const { page, pages } = pagination;
  // One page of results needs no control at all.
  if (pages <= 1) return null;

  const hrefFor = (target) => {
    const query = toQueryString({ ...filters, page: target });
    return `/properties${query ? `?${query}` : ""}`;
  };

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
      {/* Previous — rendered as inert text on page 1 rather than a dead link. */}
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink transition-colors duration-200 hover:text-accent-text"
        >
          <FiChevronLeft size={16} aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-muted">
          <FiChevronLeft size={16} aria-hidden="true" />
          Previous
        </span>
      )}

      <p className="tabular text-sm text-ink-soft">
        Page {page} of {pages}
      </p>

      {page < pages ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink transition-colors duration-200 hover:text-accent-text"
        >
          Next
          <FiChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-muted">
          Next
          <FiChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

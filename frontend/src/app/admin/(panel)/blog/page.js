"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FiPlus } from "react-icons/fi";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getBlogPosts } from "@/lib/api/admin";
import BlogTable from "@/components/admin/BlogTable";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { humanise } from "@/lib/format";

/**
 * The blog table screen (§4.2, §7 administrator only).
 *
 * Filters live in the URL, the same discipline as the listings table, the inbox and
 * the diary: a filtered view stays linkable and the back button behaves.
 */

// Mirrors PUBLICATION_STATES; the API ignores anything outside its own whitelist.
const VISIBILITY_TABS = ["", "draft", "published"];

export default function AdminBlogPage() {
  const router = useRouter();
  const params = useSearchParams();

  const publicationState = params.get("publicationState") ?? "";
  const q = params.get("q") ?? "";
  const includeDeleted = params.get("includeDeleted") === "true";
  const page = Number(params.get("page")) || 1;

  // The hook discards stale responses, so fast tab clicking cannot render an older
  // result set over a newer one.
  const { data, loading, error, refetch } = useAdminResource(
    () =>
      getBlogPosts({
        publicationState: publicationState || undefined,
        q: q || undefined,
        includeDeleted: includeDeleted ? "true" : undefined,
        page,
        limit: 20,
      }),
    [publicationState, q, includeDeleted, page],
  );

  /** Build the next URL, preserving whatever we aren't changing. */
  const navigate = (changes) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, String(value));
      else next.delete(key);
    }

    router.push(`/admin/blog?${next.toString()}`);
  };

  const pagination = data?.pagination;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Blog</h1>
          <p className="text-sm text-muted">
            {pagination ? `${pagination.total} post(s)` : " "}
          </p>
        </div>

        <Button href="/admin/blog/new">
          <FiPlus size={16} aria-hidden="true" />
          New post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
        <div className="flex flex-wrap gap-1">
          {VISIBILITY_TABS.map((tab) => (
            <button
              key={tab || "all"}
              type="button"
              // Changing a filter resets to page 1: page 3 of the old result set is
              // rarely page 3 of the new one.
              onClick={() => navigate({ publicationState: tab, page: null })}
              className={`min-h-9 cursor-pointer rounded px-3 text-sm transition-colors duration-200 ${
                publicationState === tab
                  ? "bg-accent/10 text-accent-text"
                  : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              {tab ? humanise(tab) : "All"}
            </button>
          ))}
        </div>

        <label htmlFor="blog-search" className="sr-only">
          Search posts
        </label>
        <input
          id="blog-search"
          type="search"
          defaultValue={q}
          placeholder="Title"
          // Search on Enter, not per keystroke — this is a round trip.
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate({ q: event.target.value, page: null });
          }}
          className="min-h-11 flex-1 rounded border border-border bg-surface-raised px-3 text-sm text-ink sm:max-w-xs"
        />

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(event) =>
              navigate({ includeDeleted: event.target.checked ? "true" : null, page: null })
            }
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          Show deleted
        </label>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <p className="p-8 text-sm text-danger">{error.message}</p>
      ) : (
        <BlogTable posts={data?.posts ?? []} onChanged={refetch} />
      )}

      {/* Pagination — only when there is more than one page to move between. */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3 p-5">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= pagination.pages}
            onClick={() => navigate({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

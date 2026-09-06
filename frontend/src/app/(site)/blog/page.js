import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import Section from "@/components/ui/Section";
import BlogCard from "@/components/blog/BlogCard";
import { getBlogPosts } from "@/lib/api/server";

// Root layout's title template appends " — {siteConfig.name}" — don't repeat it here.
export const metadata = {
  title: "Blog",
  description: "Market commentary and neighbourhood guides from the team.",
};

/**
 * Blog index (§4.1) — list + detail only, no category/tag archive pages (YAGNI,
 * matching the bar Team already set with no filtering).
 */
export default async function BlogPage({ searchParams }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const data = await getBlogPosts({ page });
  const posts = data?.posts ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 1 };

  return (
    <Section eyebrow="Insights" title="Market commentary and neighbourhood guides" tone="light">
      {posts.length > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>

          {/* Only when there is more than one page to move between. */}
          {pagination.pages > 1 && (
            <nav
              className="mt-10 flex items-center justify-between gap-4"
              aria-label="Pagination"
            >
              {pagination.page > 1 ? (
                <Link
                  href={`/blog?page=${pagination.page - 1}`}
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
                Page {pagination.page} of {pagination.pages}
              </p>

              {pagination.page < pagination.pages ? (
                <Link
                  href={`/blog?page=${pagination.page + 1}`}
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
          )}
        </>
      ) : (
        // Legitimately empty on a fresh copy — no seeded demo posts stand in for it,
        // same rule the testimonials rail follows.
        <p className="text-ink-soft">Our first posts are coming soon — check back shortly.</p>
      )}
    </Section>
  );
}

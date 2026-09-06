import Link from "next/link";
import { formatDate } from "@/lib/format";

/**
 * Blog index card — mirrors TeamCard's plain-card style rather than the property
 * grid's photo-forward treatment, since a post's cover image is optional (deferred
 * Cloudinary upload — the field only ever holds a pasted URL for now).
 */
export default function BlogCard({ post }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors duration-200 hover:border-accent"
    >
      {post.coverImage && (
        // Plain <img>: coverImage is a pasted URL from any host (§ deferred
        // Cloudinary upload), and next/image blocks unconfigured hosts outright.
        <img src={post.coverImage} alt="" className="h-44 w-full object-cover" />
      )}

      <div className="p-6">
        {post.publishedAt && (
          <p className="text-xs uppercase tracking-[0.1em] text-muted">
            {formatDate(post.publishedAt)}
          </p>
        )}
        <h3 className="mt-2 text-lg text-ink group-hover:text-accent-text">{post.title}</h3>
        {post.excerpt && <p className="mt-2 text-sm text-ink-soft">{post.excerpt}</p>}

        {post.categories?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink-soft"
              >
                {category}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

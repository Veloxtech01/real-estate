import { notFound } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import Container from "@/components/ui/Container";
import { getBlogPost } from "@/lib/api/server";
import { formatDate } from "@/lib/format";

/** Next 16: params is a Promise. A missing/draft/deleted slug gets generic metadata. */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getBlogPost(slug);
  if (!data?.post) return { title: "Post not found" };

  const { post } = data;
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    openGraph: (post.ogImage || post.coverImage) ? { images: [post.ogImage || post.coverImage] } : undefined,
  };
}

/**
 * One post (§4.1). A draft, a soft-deleted post, and an unknown slug are all
 * indistinguishable 404s — the API already enforces this, so nothing extra happens
 * here.
 */
export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const data = await getBlogPost(slug);

  if (!data?.post) notFound();

  const { post } = data;
  // Only link to the author's public profile if it would actually resolve —
  // otherwise render the name as plain text, same rule the property detail page
  // uses for its assigned-agent card.
  const authorIsLinkable = post.author?.isPublic && post.author?.isActive;

  return (
    <Container className="py-16 md:py-24">
      <article className="mx-auto max-w-2xl">
        <Link href="/blog" className="text-sm text-accent-text hover:underline">
          &larr; Back to Blog
        </Link>

        <h1 className="mt-4 text-3xl text-ink md:text-4xl">{post.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
          {post.author && (
            <>
              <span aria-hidden="true">&middot;</span>
              {authorIsLinkable ? (
                <Link href={`/team/${post.author.slug}`} className="text-accent-text hover:underline">
                  {post.author.name}
                </Link>
              ) : (
                <span>{post.author.name}</span>
              )}
            </>
          )}
        </div>

        {post.coverImage && (
          // Plain <img>: coverImage is a pasted URL from any host (deferred
          // Cloudinary upload), and next/image blocks unconfigured hosts outright.
          <img
            src={post.coverImage}
            alt=""
            className="mt-8 h-64 w-full rounded-lg object-cover md:h-96"
          />
        )}

        {post.categories?.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
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

        {/* Markdown body — react-markdown never executes raw HTML, so a compromised
            or careless admin account can't inject a script through it. No Tailwind
            Typography plugin is installed, so spacing for the elements Markdown can
            produce is set here via child selectors rather than a `prose` class. */}
        <div
          className="mt-8 text-ink-soft [&_a]:text-accent-text [&_a]:underline
            [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:text-ink
            [&_li]:mt-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6
            [&_p]:mt-4 [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
        >
          <Markdown>{post.body}</Markdown>
        </div>

        {post.tags?.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs text-muted">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </Container>
  );
}

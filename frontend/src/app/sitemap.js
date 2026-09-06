import { getProperties, getBlogPosts } from "@/lib/api/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Auto-regenerating sitemap (scope §4.4).
 *
 * Only published, non-deleted listings appear — the API's public scope already
 * enforces that, so nothing extra is filtered here. The page size is the API's hard
 * cap of 48; this walks the pages until it has them all.
 */
export default async function sitemap() {
  const staticRoutes = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/properties`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },
  ];

  const listings = [];
  let page = 1;
  let totalPages = 1;

  // Walk the paginated endpoint rather than requesting an unbounded page.
  do {
    const data = await getProperties({ page, limit: 48 });
    for (const property of data?.properties ?? []) {
      listings.push({
        url: `${SITE_URL}/property/${property.slug}`,
        lastModified: property.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    totalPages = data?.pagination?.pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  // Blog posts drive organic search (§4.1) just as much as listings do, so they
  // get the same paginated walk rather than being left out like Team/About.
  const posts = [];
  let postPage = 1;
  let postTotalPages = 1;

  do {
    const data = await getBlogPosts({ page: postPage, limit: 24 });
    for (const post of data?.posts ?? []) {
      posts.push({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: post.publishedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    postTotalPages = data?.pagination?.pages ?? 1;
    postPage += 1;
  } while (postPage <= postTotalPages);

  return [...staticRoutes, ...listings, ...posts];
}

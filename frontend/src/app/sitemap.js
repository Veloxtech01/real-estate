import { getProperties } from "@/lib/api/server";

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

  return [...staticRoutes, ...listings];
}

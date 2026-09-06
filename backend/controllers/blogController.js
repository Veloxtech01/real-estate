import BlogPost from "../model/blogPostModel.js";
import ApiError from "../utils/ApiError.js";

/**
 * Public blog — market commentary and neighbourhood write-ups (§4.1).
 *
 * Exists for organic search: cheap-to-produce editorial content is a meaningful
 * share of the traffic that eventually converts, the same reasoning behind the area
 * landing pages. The AI search pipeline never touches this model — a post's body is
 * staff-written, not generated.
 */

/** Card fields for the list view — enough to render a grid without the full body. */
const LIST_FIELDS = "title slug excerpt coverImage categories tags author publishedAt";

/** Everything the detail page needs, on top of the list fields. */
const DETAIL_FIELDS = `${LIST_FIELDS} body metaTitle metaDescription ogImage updatedAt`;

/** Author projection — the frontend needs isPublic/isActive to decide whether to link. */
const AUTHOR_FIELDS = "name slug photo position isPublic isActive";

/**
 * GET /api/blog — the blog index, newest published post first.
 *
 * Takes: (req, res); query: page, limit (default 9, capped at 24).
 * Returns: nothing; sends { success, data: { posts, pagination } }.
 */
export async function listBlogPosts(req, res) {
  // Public scope is unconditional here, not per-caller — a draft or soft-deleted
  // post must never appear in this list, matching the property query builder's rule.
  const query = { publicationState: "published", deletedAt: null };

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 9));

  const [posts, total] = await Promise.all([
    BlogPost.find(query)
      .select(LIST_FIELDS)
      .populate("author", AUTHOR_FIELDS)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BlogPost.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

/**
 * GET /api/blog/:slug — one post.
 *
 * Takes: (req, res); req.params.slug.
 * Returns: nothing; sends { success, data: { post } }.
 * Throws: ApiError 404 — a draft, a soft-deleted post, and an unknown slug are all
 *         indistinguishable, matching the rule already used for properties and agents.
 */
export async function getBlogPostBySlug(req, res) {
  const post = await BlogPost.findOne({
    slug: req.params.slug,
    publicationState: "published",
    deletedAt: null,
  })
    .select(DETAIL_FIELDS)
    .populate("author", AUTHOR_FIELDS)
    .lean();

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  res.status(200).json({ success: true, data: { post } });
}

import BlogPost from "../model/blogPostModel.js";
import ApiError from "../utils/ApiError.js";
import { slugify } from "../utils/slugify.js";
import { buildSearchRegex } from "../utils/escapeRegex.js";
import { PUBLICATION_STATES } from "../utils/constants.js";

/**
 * Admin blog management (§4.2, §7 administrator-only).
 *
 * Unlike listings and leads there is no ownership scoping here: §7's role table
 * lists blog under the Administrator row, not the Agent row, so every route in
 * adminBlogRoutes is gated by authorizeRole("administrator") rather than a
 * per-caller query filter.
 */

/** Fields a client may set. slug, publishedAt and deletedAt are always
 *  server-controlled, the same discipline adminPropertyController uses. */
const WRITABLE_FIELDS = [
  "title",
  "excerpt",
  "body",
  "coverImage",
  "author",
  "categories",
  "tags",
  "metaTitle",
  "metaDescription",
  "ogImage",
];

function pickWritable(body = {}) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => WRITABLE_FIELDS.includes(key))
  );
}

/**
 * Builds a collision-free slug from a title, appending -2, -3, … as needed.
 *
 * Takes: title (string), excludeId (ObjectId, optional — the post being edited).
 * Returns: a promise resolving to the unique slug.
 */
async function uniquePostSlug(title, excludeId) {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  while (
    await BlogPost.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * GET /api/admin/blog — the editorial table.
 *
 * Unlike the public index this returns drafts and soft-deleted posts.
 *
 * Takes: (req, res); query: q, publicationState, includeDeleted, page, limit.
 * Returns: nothing; sends { success, data: { posts, pagination } }.
 */
export async function listAdminBlogPosts(req, res) {
  const query = {};

  if (PUBLICATION_STATES.includes(req.query.publicationState)) {
    query.publicationState = req.query.publicationState;
  }

  // Soft-deleted posts are hidden unless explicitly requested, matching the
  // listings table's default view.
  if (req.query.includeDeleted !== "true") query.deletedAt = null;

  if (req.query.q) {
    query.title = buildSearchRegex(String(req.query.q).trim());
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const [posts, total] = await Promise.all([
    BlogPost.find(query)
      .select("title slug publicationState author updatedAt publishedAt deletedAt")
      .populate("author", "name slug")
      .sort({ updatedAt: -1 })
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
 * GET /api/admin/blog/:id — one post, for the editor.
 *
 * Takes: (req, res); req.params.id.
 * Returns: nothing; sends { success, data: { post } }.
 * Throws: ApiError 404 when missing.
 */
export async function getAdminBlogPost(req, res) {
  const post = await BlogPost.findById(req.params.id).populate("author", "name slug").lean();

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  res.status(200).json({ success: true, data: { post } });
}

/**
 * POST /api/admin/blog — create a post.
 *
 * Takes: (req, res); body per WRITABLE_FIELDS plus publicationState.
 * Returns: nothing; sends 201 with { success, data: { post } }.
 * Throws: ApiError 400 when title is missing.
 */
export async function createBlogPost(req, res) {
  const { title } = req.body ?? {};
  if (!title?.trim()) {
    throw new ApiError(400, "Invalid post details", { title: "Title is required" });
  }

  const data = pickWritable(req.body);
  data.slug = await uniquePostSlug(title);

  // Draft unless the caller explicitly asks to publish — the model's own
  // pre("save") hook stamps publishedAt the first time this becomes "published".
  data.publicationState =
    req.body.publicationState === "published" ? "published" : "draft";

  const post = await BlogPost.create(data);

  res.status(201).json({ success: true, data: { post } });
}

/**
 * PATCH /api/admin/blog/:id — update a post.
 *
 * Takes: (req, res); body per WRITABLE_FIELDS plus publicationState.
 * Returns: nothing; sends { success, data: { post } }.
 * Throws: ApiError 404 when missing.
 */
export async function updateBlogPost(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const data = pickWritable(req.body);

  // Keep the slug in step with a retitled post, the same rule updateProperty
  // applies to a retitled listing.
  if (data.title && data.title !== post.title) {
    data.slug = await uniquePostSlug(data.title, post._id);
  }

  if (PUBLICATION_STATES.includes(req.body.publicationState)) {
    post.publicationState = req.body.publicationState;
  }

  // Assign through set()/save() rather than findByIdAndUpdate, so the
  // publishedAt-stamping hook actually runs.
  post.set(data);
  await post.save();

  res.status(200).json({ success: true, data: { post } });
}

/**
 * DELETE /api/admin/blog/:id — soft delete.
 *
 * Takes: (req, res); req.params.id.
 * Returns: nothing; sends { success, data: null }.
 * Throws: ApiError 404 when missing.
 *
 * Soft, never hard: a post's URL may be linked from elsewhere, so removing it must
 * stay reversible — the same reasoning Property's soft delete uses.
 */
export async function softDeleteBlogPost(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  post.deletedAt = new Date();
  post.publicationState = "draft";
  await post.save();

  res.status(200).json({ success: true, data: null });
}

/**
 * POST /api/admin/blog/:id/restore — undo a soft delete.
 *
 * Takes: (req, res); req.params.id.
 * Returns: nothing; sends { success, data: { post } }.
 * Throws: ApiError 404 when missing.
 */
export async function restoreBlogPost(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  post.deletedAt = null;
  await post.save();

  res.status(200).json({ success: true, data: { post } });
}

import { Router } from "express";

import {
  listAdminBlogPosts,
  getAdminBlogPost,
  createBlogPost,
  updateBlogPost,
  softDeleteBlogPost,
  restoreBlogPost,
} from "../controllers/adminBlogController.js";
import { requireAuth, authorizeRole } from "../middleware/auth.js";

/**
 * Admin blog routes, mounted at /api/admin/blog.
 *
 * Administrator-only per §7's role table — no ownership scoping, unlike listings.
 */
const router = Router();

router.use(requireAuth, authorizeRole("administrator"));

router.get("/", listAdminBlogPosts);
router.post("/", createBlogPost);

// Declared after the collection routes; ":id" would otherwise swallow them.
router.get("/:id", getAdminBlogPost);
router.patch("/:id", updateBlogPost);
router.delete("/:id", softDeleteBlogPost);
router.post("/:id/restore", restoreBlogPost);

export default router;

import { Router } from "express";
import { listBlogPosts, getBlogPostBySlug } from "../controllers/blogController.js";

/** Public blog routes — the index and individual post pages (§4.1). */
const router = Router();
router.get("/", listBlogPosts);
router.get("/:slug", getBlogPostBySlug);

export default router;

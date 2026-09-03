import { Router } from "express";
import {
  listProperties,
  getPropertyBySlug,
  listFeaturedProperties,
} from "../controllers/propertyController.js";

/**
 * Public property routes, mounted at /api/properties.
 *
 * Read-only. Admin listing management (create/edit/soft delete, §4.2) will mount
 * separately behind authentication — this file must stay public-safe.
 */
const router = Router();

// Must precede /:slug, otherwise "featured" would be captured as a slug.
router.get("/featured", listFeaturedProperties);

router.get("/", listProperties);
router.get("/:slug", getPropertyBySlug);

export default router;

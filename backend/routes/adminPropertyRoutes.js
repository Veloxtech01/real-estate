import { Router } from "express";

import {
  listAdminProperties,
  getAdminProperty,
  createProperty,
  updateProperty,
  softDeleteProperty,
  restoreProperty,
  featureProperty,
} from "../controllers/adminPropertyController.js";
import { requireAuth, authorizeRole } from "../middleware/auth.js";

/**
 * Admin listing routes, mounted at /api/admin/properties.
 *
 * Every route here requires a session. Per-listing ownership (§7: agents manage only
 * their own) is checked in the controller, since it depends on the record itself.
 */
const router = Router();

// Applied once at the router level so a new route can't be added unprotected.
router.use(requireAuth);

router.get("/", listAdminProperties);
router.post("/", createProperty);

// Declared after the collection routes; ":id" would otherwise swallow them.
router.get("/:id", getAdminProperty);
router.patch("/:id", updateProperty);
router.delete("/:id", softDeleteProperty);
router.post("/:id/restore", restoreProperty);

// Homepage placement is an editorial decision, so administrators only — an agent
// should not be able to promote their own listing to the homepage.
router.post("/:id/feature", authorizeRole("administrator"), featureProperty);

export default router;

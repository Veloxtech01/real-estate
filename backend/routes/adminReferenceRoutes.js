import { Router } from "express";

import { getAdminReference } from "../controllers/referenceController.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Admin reference-data route, mounted at /api/admin/reference.
 *
 * Its own router rather than a route on adminPropertyRoutes, because the payload is
 * shared vocabulary rather than a property resource — the staff editor, and later the
 * settings and blog screens, all read from it.
 */
const router = Router();

// Applied at the router level, matching the other admin routers, so a route added
// here cannot end up unprotected.
router.use(requireAuth);

router.get("/", getAdminReference);

export default router;

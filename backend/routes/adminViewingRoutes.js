import { Router } from "express";

import {
  listViewings,
  getViewing,
  updateViewing,
  deleteViewing,
} from "../controllers/adminViewingController.js";
import { requireAuth, authorizeRole } from "../middleware/auth.js";

/**
 * Admin viewing routes — the agency diary (§4.2).
 *
 * Ownership scoping happens inside the controller, because it shapes the query rather
 * than gating the route.
 */
const router = Router();

router.use(requireAuth);

router.get("/", listViewings);
router.get("/:id", getViewing);
router.patch("/:id", updateViewing);

// Permanent erasure is an administrator's decision alone.
router.delete("/:id", authorizeRole("administrator"), deleteViewing);

export default router;

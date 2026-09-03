import { Router } from "express";

import {
  listEnquiries,
  enquiryStats,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from "../controllers/adminEnquiryController.js";
import { requireAuth, authorizeRole } from "../middleware/auth.js";

/**
 * Admin enquiry routes — the lead inbox (§4.2).
 *
 * Nothing here is public. Ownership scoping happens inside the controller, because it
 * shapes the query rather than gating the route.
 */
const router = Router();

// Every route below requires a session.
router.use(requireAuth);

// MUST precede "/:id" — otherwise Express matches "stats" as an enquiry id and the
// route fails on a CastError.
router.get("/stats", enquiryStats);

router.get("/", listEnquiries);
router.get("/:id", getEnquiry);
router.patch("/:id", updateEnquiry);

// Permanent erasure is an administrator's decision alone.
router.delete("/:id", authorizeRole("administrator"), deleteEnquiry);

export default router;

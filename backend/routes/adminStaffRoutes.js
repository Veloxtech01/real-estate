import { Router } from "express";
import { requireAuth, authorizeRole } from "../middleware/auth.js";
import {
  listStaff,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
} from "../controllers/adminStaffController.js";

/**
 * Admin staff routes, mounted at /api/admin/staff.
 *
 * Guarded at the router level, administrator-only — §7 lists "staff" only under the
 * Administrator role, so a route added here later can't end up unprotected, and an
 * agent never even reaches the controller to be told no.
 */
const router = Router();
router.use(requireAuth, authorizeRole("administrator"));

router.get("/", listStaff);
router.get("/:id", getStaffMember);
router.post("/", createStaffMember);
router.patch("/:id", updateStaffMember);

export default router;

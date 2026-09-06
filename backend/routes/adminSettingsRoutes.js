import { Router } from "express";
import { requireAuth, authorizeRole } from "../middleware/auth.js";
import { getSettings, updateSettings } from "../controllers/adminSettingsController.js";

/**
 * Admin settings routes, mounted at /api/admin/settings.
 *
 * Guarded at the router level, administrator-only — site branding, contact details,
 * AI spend cap and compliance numbers are agency-level decisions, not per-agent, same
 * gating as Staff and Blog.
 */
const router = Router();
router.use(requireAuth, authorizeRole("administrator"));

router.get("/", getSettings);
router.patch("/", updateSettings);

export default router;

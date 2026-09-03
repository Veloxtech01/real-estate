import { Router } from "express";
import { getHealth } from "../controllers/healthController.js";

/**
 * Health check routes, mounted at /api/health.
 *
 * Route files stay thin by convention (CLAUDE.md): they wire paths to controllers
 * and nothing else.
 */
const router = Router();

// Liveness/readiness probe — intentionally unauthenticated so external uptime
// monitors can reach it.
router.get("/", getHealth);

export default router;

import { Router } from "express";
import { listAgents, getAgentBySlug } from "../controllers/agentController.js";

/** Public agent directory routes — team roster and individual profile pages (§3). */
const router = Router();
router.get("/", listAgents);
router.get("/:slug", getAgentBySlug);

export default router;

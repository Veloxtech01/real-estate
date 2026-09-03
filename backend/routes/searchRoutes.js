import { Router } from "express";
import { naturalLanguageSearch } from "../controllers/searchController.js";
import { strictLimiter } from "../middleware/rateLimiter.js";

/**
 * Natural-language search, mounted at /api/search.
 *
 * strictLimiter rather than the global limit: §5.6 requires per-session and per-IP
 * rate limiting specifically because this endpoint can spend money per call, and it
 * is exposed to the open internet with no authentication.
 *
 * POST rather than GET so the phrase isn't logged in URLs or referrers, and isn't
 * capped by URL length.
 */
const router = Router();

router.post("/", strictLimiter, naturalLanguageSearch);

export default router;

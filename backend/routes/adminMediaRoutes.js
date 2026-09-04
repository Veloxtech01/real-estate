import { Router } from "express";

import {
  createUploadSignature,
  registerMedia,
  reorderMedia,
  updateMedia,
  deleteMedia,
} from "../controllers/adminMediaController.js";
import { strictLimiter } from "../middleware/rateLimiter.js";

/**
 * Listing gallery routes, mounted at /api/admin/properties/:id/media.
 *
 * mergeParams is required, not optional: without it `req.params.id` is undefined in
 * every handler and each one 404s on a listing that exists. The session check comes
 * from the parent router's requireAuth; per-listing ownership is checked in the
 * controller, since it depends on the record.
 */
const router = Router({ mergeParams: true });

// Charged per call against the Cloudinary account, so it gets the strict limiter —
// the same rule the AI search and lead-capture endpoints follow.
router.post("/signature", strictLimiter, createUploadSignature);

// No strict limiter: the spend already happened at the signature step, and a retry
// after a dropped connection must not be throttled into failing.
router.post("/", registerMedia);

// "/order" must be declared before "/:mediaId", or the parameterised route swallows
// it and tries to update a media document whose id is the string "order". Same rule
// as /properties/featured before /:slug.
router.patch("/order", reorderMedia);
router.patch("/:mediaId", updateMedia);
router.delete("/:mediaId", deleteMedia);

export default router;

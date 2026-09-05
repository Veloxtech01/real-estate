import { Router } from "express";
import { listTestimonials } from "../controllers/testimonialController.js";

/** Public testimonials route (§3) — read-only, no submission path. */
const router = Router();
router.get("/", listTestimonials);

export default router;

import { Router } from "express";
import { createEnquiry, createViewing } from "../controllers/enquiryController.js";
import { strictLimiter } from "../middleware/rateLimiter.js";

/**
 * Public lead-capture routes.
 *
 * Both endpoints send email on every successful call, so they carry strictLimiter
 * rather than relying on the global API limit — an unthrottled public form that
 * triggers mail is an abuse vector and a cost (§5.6 applies the same reasoning to AI
 * search).
 *
 * Reading enquiries is deliberately absent: the inbox (§4.2) is admin-only and will
 * mount behind authentication.
 */
export const enquiryRouter = Router();
enquiryRouter.post("/", strictLimiter, createEnquiry);

export const viewingRouter = Router();
viewingRouter.post("/", strictLimiter, createViewing);

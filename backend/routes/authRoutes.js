import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  login,
  logout,
  getCurrentUser,
  changePassword,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Staff authentication routes, mounted at /api/auth.
 *
 * No registration route exists — administrators create accounts (§7).
 */
const router = Router();

/**
 * Login-specific throttling.
 *
 * Tighter than strictLimiter and keyed the same way, because this endpoint is the
 * one an attacker brute-forces. Successful logins don't count against the limit, so
 * a busy office isn't locked out by its own staff signing in.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, please try again later." },
});

router.post("/login", loginLimiter, login);
router.post("/logout", logout);

// Everything below requires a session.
router.get("/me", requireAuth, getCurrentUser);
router.post("/change-password", requireAuth, changePassword);

export default router;

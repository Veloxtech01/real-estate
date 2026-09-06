import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/healthRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import testimonialRoutes from "./routes/testimonialRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import {
  locationRouter,
  taxonomyRouter,
  filterRouter,
  settingsRouter,
} from "./routes/referenceRoutes.js";
import { enquiryRouter, viewingRouter } from "./routes/enquiryRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminPropertyRoutes from "./routes/adminPropertyRoutes.js";
import adminEnquiryRoutes from "./routes/adminEnquiryRoutes.js";
import adminViewingRoutes from "./routes/adminViewingRoutes.js";
import adminReferenceRoutes from "./routes/adminReferenceRoutes.js";
import adminStaffRoutes from "./routes/adminStaffRoutes.js";
import adminBlogRoutes from "./routes/adminBlogRoutes.js";
import adminSettingsRoutes from "./routes/adminSettingsRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

/**
 * Builds and returns the configured Express application.
 *
 * Kept separate from index.js (which owns the HTTP listener) so tests can mount
 * the app with supertest without binding a port.
 *
 * Takes: nothing — reads CLIENT_URL from the environment for CORS.
 * Returns: a configured Express app instance.
 */
export function createApp() {
  const app = express();

  // Behind a proxy/CDN (Cloudflare is planned — scope doc §10.3) the client IP
  // arrives in X-Forwarded-For. Without this, rate limiting would see the proxy's
  // IP and throttle every visitor as if they were one person.
  app.set("trust proxy", 1);

  // Cookie auth means the browser must send credentials cross-origin, which
  // requires an explicit origin — a wildcard is not permitted with credentials.
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    })
  );

  // Body parsers. The size cap is a cheap guard against oversized JSON payloads;
  // file uploads bypass this and go through multer instead.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Baseline throttling across the whole API. Endpoints that cost money per call
  // (AI search, enquiries) additionally apply strictLimiter at their own route.
  app.use("/api", apiLimiter);

  // Feature routes mount here, all under /api.
  app.use("/api/health", healthRoutes);

  // Public read API — the property search, detail pages and the reference data the
  // filter panel needs.
  app.use("/api/properties", propertyRoutes);
  app.use("/api/locations", locationRouter);
  app.use("/api/taxonomy", taxonomyRouter);
  app.use("/api/agents", agentRoutes);
  app.use("/api/testimonials", testimonialRoutes);
  app.use("/api/blog", blogRoutes);
  app.use("/api/filters", filterRouter);
  app.use("/api/settings", settingsRouter);

  // Natural-language search. Applies its own stricter rate limit — it can spend
  // money per call and is unauthenticated.
  app.use("/api/search", searchRoutes);

  // Lead capture. These apply their own stricter rate limit per route.
  app.use("/api/enquiries", enquiryRouter);
  app.use("/api/viewings", viewingRouter);

  // Staff authentication, and the admin surface behind it. Everything under
  // /api/admin requires a session — enforced at each admin router, not here, so a
  // route can't be mounted outside the guard by accident.
  app.use("/api/auth", authRoutes);
  app.use("/api/admin/properties", adminPropertyRoutes);
  app.use("/api/admin/enquiries", adminEnquiryRoutes);
  app.use("/api/admin/viewings", adminViewingRoutes);

  // Staff management (§7) — administrator-only CRUD over agentModel.
  app.use("/api/admin/staff", adminStaffRoutes);

  // Blog editor (§4.2, §7) — administrator-only CRUD over blogPostModel.
  app.use("/api/admin/blog", adminBlogRoutes);

  // Settings screen (§9, §11) — administrator-only read/write over the singleton.
  app.use("/api/admin/settings", adminSettingsRoutes);

  // Shared editor vocabulary — enums, the statutory rent table, the staff roster.
  app.use("/api/admin/reference", adminReferenceRoutes);

  // Anything unmatched becomes a 404 ApiError, then every error — including ones
  // thrown inside async controllers, which Express 5 forwards automatically —
  // leaves through the single error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;

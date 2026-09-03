import { Router } from "express";
import {
  listLocations,
  getLocationBySlug,
  listTaxonomy,
  getFilterOptions,
  getPublicSettings,
} from "../controllers/referenceController.js";

/**
 * Public reference-data routes.
 *
 * Mounted individually in app.js rather than under one prefix, because these are
 * distinct top-level resources to a consumer (/api/locations, /api/taxonomy,
 * /api/filters, /api/settings) even though one controller serves them.
 */
export const locationRouter = Router();
locationRouter.get("/", listLocations);
locationRouter.get("/:slug", getLocationBySlug);

export const taxonomyRouter = Router();
taxonomyRouter.get("/", listTaxonomy);

export const filterRouter = Router();
filterRouter.get("/", getFilterOptions);

export const settingsRouter = Router();
settingsRouter.get("/", getPublicSettings);

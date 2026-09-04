import { v2 as cloudinary } from "cloudinary";

import logger from "../utils/logger.js";

/**
 * Cloudinary SDK configuration for listing photography (scope §10.1/§10.3).
 *
 * Deliberately tolerant of missing credentials, matching config/db.js: app.js imports
 * the whole route tree eagerly, so throwing here would take the entire API down
 * because one optional integration is unconfigured. The media endpoints return 503
 * instead, and every other admin screen keeps working.
 */

/** Warn once per process rather than on every request that touches the SDK. */
let warned = false;

/**
 * Whether all three credentials are present.
 *
 * Read from process.env on every call rather than captured at import: a deploy that
 * adds the variables should start working without also needing a code change, and
 * the tests vary them between cases.
 *
 * Takes: nothing.
 * Returns: true when cloud name, key and secret are all non-empty.
 */
export function isCloudinaryConfigured() {
  const configured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

  if (!configured && !warned) {
    logger.warn(
      "Cloudinary is not configured — image upload is disabled. " +
        "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
    warned = true;
  }

  return configured;
}

/**
 * Applies the current environment to the SDK singleton.
 *
 * Called before each SDK use rather than once at import, for the same reason
 * isCloudinaryConfigured() re-reads: the credentials are not known to be present when
 * this module is first loaded.
 *
 * Takes: nothing.
 * Returns: the configured cloudinary v2 instance.
 */
export function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    // Without this the SDK hands back http:// delivery URLs, which we would then
    // store — and which become mixed-content warnings on the public listing page.
    secure: true,
  });

  return cloudinary;
}

export default cloudinary;

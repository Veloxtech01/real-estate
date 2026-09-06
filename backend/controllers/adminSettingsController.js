import Settings from "../model/settingsModel.js";
import ApiError from "../utils/ApiError.js";

/**
 * Admin settings screen (§9, §11) — administrator-only read/write over the Settings
 * singleton.
 *
 * There is no POST/DELETE here: the singleton always exists via Settings.get(), which
 * self-creates a placeholder document on first call.
 */

/** Top-level fields a client may set directly via settings.set(). theme and aiSearch
 *  are handled separately below because they are sub-objects that must be merged,
 *  not replaced. */
const WRITABLE_FIELDS = [
  "agencyName",
  "tagline",
  "lasreraNumber",
  "registrationNumbers",
  "email",
  "phone",
  "whatsapp",
  "address",
  "coordinates",
  "officeHours",
  "socialLinks",
  "footerText",
  "listingDisclaimer",
  "ndpcRegistrationNumber",
  "googleAnalyticsId",
  "googleSearchConsoleId",
];

/** theme sub-fields a client may set. homepageVariant is deliberately absent — no
 *  admin UI reads or needs it yet, so it stays direct-DB-write only. */
const THEME_WRITABLE_FIELDS = ["colors", "logoUrl", "logoDarkUrl", "faviconUrl", "fontHeading", "fontBody"];

/** The core brand color tokens the admin form's palette section may set. Status/
 *  structural colors (muted, taupe, border, text, success, warning, danger) are not
 *  brand identity a client rebrand changes, so they stay out of this list. */
const THEME_COLOR_KEYS = [
  "ink",
  "ink-deep",
  "ink-raised",
  "ink-soft",
  "accent",
  "accent-text",
  "accent-hover",
  "surface",
  "surface-raised",
];

/** aiSearch sub-fields a client may set. currentSpendUsd is deliberately absent —
 *  it is a running total, never a user-editable value, even from this screen. */
const AI_SEARCH_WRITABLE_FIELDS = ["enabled", "monthlySpendCapUsd", "timeoutMs"];

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

/**
 * Copies only permitted top-level fields from a request body.
 *
 * Takes: body (object).
 * Returns: an object containing just the writable fields that were present.
 */
function pickWritable(body = {}) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => WRITABLE_FIELDS.includes(key)));
}

/**
 * Merges the writable subset of an incoming theme patch onto the current theme, so a
 * partial update (e.g. one color) never drops the rest — homepageVariant included,
 * even though it isn't writable here.
 *
 * Takes: currentTheme (Mongoose subdocument); patch (object|undefined).
 * Returns: a plain object — the new theme value for settings.set().
 */
function mergeTheme(currentTheme, patch) {
  const current = currentTheme?.toObject ? currentTheme.toObject() : currentTheme ?? {};
  if (!patch || typeof patch !== "object") return current;

  const next = { ...current };
  for (const key of THEME_WRITABLE_FIELDS) {
    if (!(key in patch)) continue;
    if (key === "colors") {
      // Colors themselves merge one level deeper, so setting just `accent` doesn't
      // drop a previously-set `ink`.
      next.colors = { ...(current.colors ?? {}), ...pickColors(patch.colors) };
    } else {
      next[key] = patch[key];
    }
  }
  return next;
}

/** Restricts an incoming colors object to the whitelisted core token keys. */
function pickColors(colors = {}) {
  if (!colors || typeof colors !== "object") return {};
  return Object.fromEntries(
    Object.entries(colors).filter(([key]) => THEME_COLOR_KEYS.includes(key)),
  );
}

/**
 * Merges the writable subset of an incoming aiSearch patch onto the current value.
 * currentSpendUsd is never taken from the patch, even if present in the body.
 *
 * Takes: currentAiSearch (Mongoose subdocument); patch (object|undefined).
 * Returns: a plain object — the new aiSearch value for settings.set().
 */
function mergeAiSearch(currentAiSearch, patch) {
  const current = currentAiSearch?.toObject ? currentAiSearch.toObject() : currentAiSearch ?? {};
  if (!patch || typeof patch !== "object") return current;

  const next = { ...current };
  for (const key of AI_SEARCH_WRITABLE_FIELDS) {
    if (key in patch) next[key] = patch[key];
  }
  return next;
}

/**
 * Validates the writable subset of a PATCH body, keyed by dotted field path so the
 * admin form can map a message straight onto the input that caused it.
 *
 * Takes: body (object).
 * Returns: an object of dotted-path → message; empty when nothing failed.
 */
function validate(body = {}) {
  const errors = {};

  if ("agencyName" in body && !body.agencyName?.trim()) {
    errors.agencyName = "Agency name is required";
  }

  if ("email" in body && body.email && !EMAIL_SHAPE.test(body.email)) {
    errors.email = "Enter a valid email address";
  }

  const colors = body.theme?.colors;
  if (colors && typeof colors === "object") {
    for (const [key, value] of Object.entries(colors)) {
      if (THEME_COLOR_KEYS.includes(key) && value && !HEX_COLOR.test(value)) {
        errors[`theme.colors.${key}`] = "Enter a valid hex color";
      }
    }
  }

  const aiSearch = body.aiSearch;
  if (aiSearch && typeof aiSearch === "object") {
    if ("monthlySpendCapUsd" in aiSearch) {
      const value = Number(aiSearch.monthlySpendCapUsd);
      if (!Number.isFinite(value) || value < 0) {
        errors["aiSearch.monthlySpendCapUsd"] = "Enter a non-negative amount";
      }
    }
    if ("timeoutMs" in aiSearch) {
      const value = Number(aiSearch.timeoutMs);
      if (!Number.isFinite(value) || value < 0) {
        errors["aiSearch.timeoutMs"] = "Enter a non-negative number of milliseconds";
      }
    }
  }

  return errors;
}

/**
 * GET /api/admin/settings — the full settings document.
 *
 * Unlike the public /api/settings projection, this includes operational fields
 * (aiSearch.currentSpendUsd/monthlySpendCapUsd, ndpcRegistrationNumber,
 * googleAnalyticsId, googleSearchConsoleId) an administrator needs to see and edit.
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { settings } }.
 */
export async function getSettings(_req, res) {
  const settings = await Settings.get();
  res.status(200).json({ success: true, data: { settings } });
}

/**
 * PATCH /api/admin/settings — update the settings document.
 *
 * Body: any of the top-level writable fields, plus nested `theme` and `aiSearch`
 * patches (merged onto the current sub-object, never replacing it wholesale).
 *
 * Takes: (req, res).
 * Returns: nothing; sends { success, data: { settings } }.
 * Throws: ApiError 400 on an invalid field (dotted-path details).
 */
export async function updateSettings(req, res) {
  // No JSON body/Content-Type sent leaves req.body undefined — guard once here
  // rather than at every access below, same convention as adminStaffController.
  const body = req.body ?? {};

  const fieldErrors = validate(body);
  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(400, "Invalid settings", fieldErrors);
  }

  const settings = await Settings.get();

  settings.set(pickWritable(body));
  settings.set({ theme: mergeTheme(settings.theme, body.theme) });
  settings.set({ aiSearch: mergeAiSearch(settings.aiSearch, body.aiSearch) });

  await settings.save();

  res.status(200).json({ success: true, data: { settings } });
}

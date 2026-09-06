import { revalidateTag } from "next/cache";

/**
 * POST /api/revalidate — invalidates the cached public settings fetch.
 *
 * Called by the admin Settings form right after a successful save, so a changed
 * brand color is visible on the next page load instead of waiting out
 * getSettings()'s 1-hour cache (frontend/src/lib/api/server.js). Hardcoded to the
 * "settings" tag — never accepted from the request — so this endpoint can't be used
 * to bust an unrelated cache tag. `{ expire: 0 }` because the admin needs the old
 * value gone immediately, not served stale while a background revalidation runs.
 *
 * Takes: nothing. Returns: a 200 JSON response.
 */
export async function POST() {
  revalidateTag("settings", { expire: 0 });
  return Response.json({ success: true });
}

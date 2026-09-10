/**
 * Pings the backend's /api/health endpoint to keep a sleeping instance (Render's free
 * tier spins down after ~15 minutes idle) warm while a visitor browses the site.
 *
 * Deliberately a raw fetch, not the shared Axios instance in lib/api/client.js: this
 * is an infrastructure keep-alive, not application data, so it must never carry
 * cookies, must never trigger the 401 interceptor's logout/redirect, and must fail
 * completely silently — a cold or unreachable backend here is not a user-facing error.
 *
 * Takes: nothing.
 * Returns: a promise that always resolves (errors are swallowed, never thrown).
 */
export function pingServer() {
  const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";
  return fetch(`${baseURL}/health`, { cache: "no-store", credentials: "omit" }).catch(() => {});
}

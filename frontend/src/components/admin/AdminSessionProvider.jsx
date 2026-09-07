"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout as apiLogout } from "@/lib/api/admin";

/**
 * Holds the signed-in staff account for the whole admin panel.
 *
 * This is layer 2 of three. The proxy guard before it is optimistic (cookie presence
 * only); the API after it is the real gate, re-loading the account on every request so
 * a deactivated staff member loses access on their next action rather than in seven
 * days. This layer exists so screens can read `user.role` without each one fetching.
 */
const AdminSessionContext = createContext(null);

/**
 * Read the current session.
 *
 * Safe to call `user.role` directly: the provider renders no children until the session
 * has resolved, so `user` is never null inside it.
 */
export function useAdminSession() {
  const context = useContext(AdminSessionContext);

  // A clearer failure than "cannot read property of null" three components deep.
  if (!context) {
    throw new Error("useAdminSession must be used inside <AdminSessionProvider>");
  }

  return context;
}

export function AdminSessionProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Load (or reload) the session. */
  const refresh = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
    } catch {
      // Any failure here means no usable session — expired, signed out elsewhere, or
      // the account was deactivated. The specific reason isn't actionable for the user.
      // Don't redirect here: getMe() failing is a 401, and the Axios interceptor
      // (lib/api/client.js) already redirects to /admin/login for every 401 — but only
      // after clearing the stale cookie first. Redirecting here too would race that
      // cleanup and send the browser to /admin/login while the cookie is still set,
      // which proxy.js bounces straight back to /admin, looping.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Sign out, then leave the panel. */
  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Clear local state even if the request failed — the user asked to leave, and a
      // stale "signed in" panel after clicking sign out is worse than a failed call.
      setUser(null);
      router.replace("/admin/login");
    }
  }, [router]);

  // Render nothing until the session resolves. Without this every screen would flash
  // through a no-permissions state before the user arrives, and role-gated controls
  // would appear and then vanish.
  if (loading || !user) return null;

  return (
    <AdminSessionContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export default AdminSessionProvider;

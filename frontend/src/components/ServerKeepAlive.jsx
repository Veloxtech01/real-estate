"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pingServer } from "@/lib/serverKeepAlive";

// Comfortably under Render free tier's ~15 minute idle sleep timeout, so a visitor
// who lingers on one page (no route change) still keeps the backend warm.
const PING_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Mounted once in the root layout so it lives across every route, admin included.
 *
 * Fires a fire-and-forget ping on mount and on every client-side navigation
 * (usePathname's return value changes on route change, re-running the effect),
 * plus a recurring interval while the tab stays on one page. Never awaited and
 * renders nothing — a cold-starting backend must never delay or block a page render.
 *
 * Takes: nothing. Returns: null.
 */
export default function ServerKeepAlive() {
  const pathname = usePathname();

  useEffect(() => {
    // Route entered — wake the server without waiting on it.
    pingServer();

    // Re-ping on an interval in case the visitor stays put longer than the
    // platform's sleep timeout without triggering another route change.
    const intervalId = setInterval(pingServer, PING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [pathname]);

  return null;
}

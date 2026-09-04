import { NextResponse } from "next/server";

/**
 * Optimistic auth guard for the admin panel.
 *
 * This checks only that the session cookie EXISTS. It cannot verify the token — the
 * signing key belongs to the backend — and it deliberately does not try. Next 16's docs
 * are explicit that Proxy (the renamed Middleware) is for optimistic checks, not
 * authorization.
 *
 * Its only job is to avoid rendering empty admin chrome before the session call
 * resolves. A forged or expired cookie sails past it and is rejected by the API, which
 * re-loads the account on every request and is the actual gate.
 */
export function proxy(request) {
  const hasSession = request.cookies.has("re_token");
  const { pathname } = request.nextUrl;

  // The login page must stay reachable without a session, or nobody can ever sign in.
  if (pathname === "/admin/login") {
    // Already signed in? Skip the form and go to the panel.
    if (hasSession) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

// Scoped to the admin panel — the public site must never pay for this check.
export const config = {
  matcher: "/admin/:path*",
};

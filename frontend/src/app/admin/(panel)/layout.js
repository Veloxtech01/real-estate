"use client";

import AdminSessionProvider from "@/components/admin/AdminSessionProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";

/**
 * Shell for every authenticated admin screen.
 *
 * "(panel)" is a route group, so it adds nothing to the URL — /admin/(panel)/page.js
 * serves /admin. The login page sits outside it precisely because it must render
 * without a session.
 *
 * The provider renders nothing until the session resolves, so the sidebar can read
 * user.role unconditionally.
 */
export default function AdminPanelLayout({ children }) {
  return (
    <AdminSessionProvider>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AdminSidebar />
        {/* min-w-0 lets wide tables scroll inside this column instead of stretching it. */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AdminSessionProvider>
  );
}

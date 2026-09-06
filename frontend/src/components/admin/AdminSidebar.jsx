"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiGrid, FiInbox, FiCalendar, FiHome, FiUsers, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import siteConfig from "@/config/site";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";

/**
 * Admin navigation. "Staff" is appended in the component body rather than listed
 * here, since it's shown only to administrators — courtesy, not security, matching
 * every other role-gated control in this panel; the API's authorizeRole is the
 * actual gate.
 */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: FiGrid },
  { href: "/admin/enquiries", label: "Enquiries", icon: FiInbox },
  { href: "/admin/viewings", label: "Viewings", icon: FiCalendar },
  { href: "/admin/properties", label: "Listings", icon: FiHome },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAdminSession();
  const [open, setOpen] = useState(false);

  const navItems =
    user.role === "administrator"
      ? [...NAV, { href: "/admin/staff", label: "Staff", icon: FiUsers }]
      : NAV;

  const nav = (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        // Exact match for the dashboard; prefix match for its children, so
        // /admin/enquiries?id=x still highlights Enquiries.
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 text-sm transition-colors duration-200 ${
              active
                ? "bg-accent/10 text-accent-text"
                : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="border-t border-border pt-4">
      <p className="text-sm text-ink">{user.name}</p>
      {/* Role is shown because it explains why some controls are absent. */}
      <p className="text-xs uppercase tracking-[0.08em] text-muted">{user.role}</p>
      <button
        type="button"
        onClick={signOut}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
      >
        <FiLogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <span className="font-display text-lg text-ink">{siteConfig.name}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
        >
          <FiMenu size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-surface p-4 lg:hidden"
          style={{ zIndex: "var(--z-dropdown)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
        >
          <div className="mb-8 flex items-center justify-between">
            <span className="font-display text-lg text-ink">{siteConfig.name}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
            >
              <FiX size={22} aria-hidden="true" />
            </button>
          </div>
          {nav}
          <div className="mt-8">{identity}</div>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border p-4 lg:flex">
        <div>
          <Link href="/admin" className="font-display text-lg text-ink">
            {siteConfig.name}
          </Link>
          <p className="mb-8 text-xs uppercase tracking-[0.08em] text-muted">Admin</p>
          {nav}
        </div>
        {identity}
      </aside>
    </>
  );
}

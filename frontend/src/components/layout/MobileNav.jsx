"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMenu, FiX } from "react-icons/fi";
import siteConfig from "@/config/site";

/**
 * Mobile navigation drawer. Client component because it holds open/closed state —
 * it is deliberately a leaf so the rest of the header stays server-rendered.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Icon-only control: aria-label is required for screen readers. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
      >
        <FiMenu size={22} aria-hidden="true" />
      </button>

      {/* Drawer renders only when open — nothing to trap focus behind when closed. */}
      {open && (
        <div
          className="fixed inset-0 bg-surface"
          style={{ zIndex: "var(--z-dropdown)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-display text-lg text-ink">{siteConfig.name}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
            >
              <FiX size={22} aria-hidden="true" />
            </button>
          </div>

          {/* Nav items come from config so a rebrand never edits this component. */}
          <nav className="flex flex-col px-4 pt-6">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-4 font-display text-2xl text-ink transition-colors duration-200 hover:text-accent-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FiMenu, FiX, FiPhone } from "react-icons/fi";
import Button from "@/components/ui/Button";
import siteConfig from "@/config/site";

/**
 * Mobile navigation drawer. Client component because it holds open/closed state —
 * it is deliberately a leaf so the rest of the header stays server-rendered.
 *
 * The drawer is navy, matching the header it opens from: an ivory sheet dropping out of
 * a navy bar reads as a different site for the moment it animates in.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  // Portals need `document`, which doesn't exist during SSR — render the
  // trigger immediately but defer the portal target until after mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const drawer = open && (
    <div
      // `on-dark` keeps the focus ring visible against the navy sheet.
      // z-lightbox (not z-dropdown): this is a full-screen overlay that must
      // paint above the sticky Header (z-header), or the header covers the
      // drawer's own close button and intercepts taps meant for it.
      className="on-dark fixed inset-0 overflow-y-auto bg-ink-deep"
      style={{ zIndex: "var(--z-lightbox)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
    >
      <div className="flex items-center justify-between px-4 py-4">
        <span className="font-display text-lg text-white">{siteConfig.name}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="flex h-11 w-11 cursor-pointer items-center justify-center text-white transition-colors duration-200 hover:text-accent"
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
            className="border-b border-white/10 py-4 font-display text-2xl text-white transition-colors duration-200 hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Both conversion paths repeated at the foot of the drawer — a visitor who
          opened the menu to find a phone number should not have to close it. */}
      <div className="flex flex-col gap-3 px-4 pt-8">
        <Button href={`tel:${siteConfig.phone}`} variant="accent" size="lg">
          <FiPhone size={16} aria-hidden="true" />
          {siteConfig.phone}
        </Button>
        <Button href={siteConfig.listPropertyHref} variant="onDarkOutline" size="lg">
          List your property
        </Button>
      </div>
    </div>
  );

  return (
    <div className="lg:hidden">
      {/* Icon-only control: aria-label is required for screen readers. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-11 w-11 cursor-pointer items-center justify-center text-white transition-colors duration-200 hover:text-accent"
      >
        <FiMenu size={22} aria-hidden="true" />
      </button>

      {/* Portalled to document.body: the header has backdrop-blur, and CSS
          spec makes any filter/backdrop-filter ancestor the containing block
          for `position: fixed` descendants — without the portal, this drawer's
          "full-screen" `inset-0` resolves against the header's own ~65px box
          instead of the viewport, and the drawer effectively never appears. */}
      {mounted && drawer && createPortal(drawer, document.body)}
    </div>
  );
}

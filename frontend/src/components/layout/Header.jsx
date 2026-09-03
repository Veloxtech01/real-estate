import Link from "next/link";
import { FiPhone } from "react-icons/fi";
import Container from "@/components/ui/Container";
import MobileNav from "@/components/layout/MobileNav";
import siteConfig from "@/config/site";

/**
 * Site header. A Server Component — only the mobile drawer needs client state.
 *
 * The wordmark is rendered from siteConfig.name rather than an image, so a copied repo
 * is renamed without producing a logo file (scope §9).
 */
export default function Header() {
  return (
    <header
      className="sticky top-0 border-b border-border bg-surface/90 backdrop-blur"
      style={{ zIndex: "var(--z-header)" }}
    >
      <Container className="flex h-16 items-center justify-between md:h-20">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-ink transition-colors duration-200 hover:text-accent-text md:text-2xl"
        >
          {siteConfig.name}
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text"
            >
              {item.label}
            </Link>
          ))}
          {/* Phone is the primary conversion channel in this market, so it sits in
              the header rather than only in the footer. */}
          <a
            href={`tel:${siteConfig.phone}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink transition-colors duration-200 hover:text-accent-text"
          >
            <FiPhone size={16} aria-hidden="true" />
            {siteConfig.phone}
          </a>
        </nav>

        <MobileNav />
      </Container>
    </header>
  );
}

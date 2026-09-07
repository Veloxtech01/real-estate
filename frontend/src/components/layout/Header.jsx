import Link from "next/link";
import { FiPhone } from "react-icons/fi";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import MobileNav from "@/components/layout/MobileNav";
import siteConfig from "@/config/site";

/**
 * Site header. A Server Component — only the mobile drawer needs client state.
 *
 * The header sits on the deep navy rather than the page ground, so every page opens and
 * closes on a dark band instead of fading into ivory at both ends. It is also the one
 * place gold is guaranteed legible (6.6:1 on navy), which is why the wordmark rule and
 * the "list your property" control are gold here and nowhere on an ivory section.
 *
 * The wordmark is rendered from siteConfig.name rather than an image, so a copied repo
 * is renamed without producing a logo file (scope §9).
 */
export default function Header() {
  return (
    <header
      // `on-dark` retargets the focus ring to brand gold for everything inside.
      className="on-dark sticky top-0 border-b border-white/10 bg-ink-deep/95 backdrop-blur"
      style={{ zIndex: "var(--z-header)" }}
    >
      <Container className="flex h-16 items-center justify-between md:h-20">
        {/* Wordmark. The gold rule beneath it is the mark's only graphic element. */}
        <Link href="/" className="group flex flex-col">
          <span className="font-display text-xl tracking-tight text-white transition-colors duration-200 group-hover:text-accent md:text-2xl">
            {siteConfig.name}
          </span>
          <span
            className="mt-0.5 h-px w-8 bg-accent transition-all duration-200 group-hover:w-full"
            aria-hidden="true"
          />
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-8 lg:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/80 transition-colors duration-200 hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
          {/* Phone is the primary conversion channel in this market, so it sits in
              the header rather than only in the footer. */}
          <a
            href={`tel:${siteConfig.phone}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white transition-colors duration-200 hover:text-accent"
          >
            <FiPhone size={16} className="text-accent" aria-hidden="true" />
            {siteConfig.phone}
          </a>
          {/* Seller-side CTA — routes to the §3 "list your property" page. */}
          <Button href={siteConfig.listPropertyHref} variant="onDarkOutline">
            List your property
          </Button>
        </nav>

        <MobileNav />
      </Container>
    </header>
  );
}

import Link from "next/link";
import { FiInstagram, FiFacebook, FiTwitter, FiLinkedin } from "react-icons/fi";
import Container from "@/components/ui/Container";
import siteConfig from "@/config/site";

// Social platform key -> icon. Only platforms with a configured URL are rendered.
const SOCIAL_ICONS = {
  instagram: FiInstagram,
  facebook: FiFacebook,
  twitter: FiTwitter,
  linkedin: FiLinkedin,
};

/**
 * Site footer. All content comes from siteConfig — no address, phone number or
 * agency name is written into this file.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink text-white/70">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Brand + tagline */}
          <div>
            <p className="font-display text-2xl text-white">{siteConfig.name}</p>
            <p className="mt-3 max-w-[40ch] text-sm">{siteConfig.tagline}</p>
          </div>

          {/* Navigation mirror */}
          <nav className="flex flex-col gap-3 text-sm">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors duration-200 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Contact block */}
          <div className="space-y-3 text-sm">
            <a
              href={`tel:${siteConfig.phone}`}
              className="block transition-colors duration-200 hover:text-white"
            >
              {siteConfig.phone}
            </a>
            <a
              href={`mailto:${siteConfig.email}`}
              className="block transition-colors duration-200 hover:text-white"
            >
              {siteConfig.email}
            </a>
            <p className="max-w-[36ch]">{siteConfig.address}</p>
            {/* Office hours render as a list; an empty array simply renders nothing. */}
            {siteConfig.officeHours.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs">
            © {year} {siteConfig.legalName}. All rights reserved.
          </p>

          {/* Social icons — only those with a URL configured. */}
          <div className="flex gap-4">
            {Object.entries(siteConfig.socials).map(([key, url]) => {
              const Icon = SOCIAL_ICONS[key];
              if (!url || !Icon) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={key}
                  className="flex h-11 w-11 items-center justify-center transition-colors duration-200 hover:text-white"
                >
                  <Icon size={18} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
      </Container>
    </footer>
  );
}

import Link from "next/link";
import {
  FiInstagram,
  FiFacebook,
  FiTwitter,
  FiLinkedin,
  FiPhone,
  FiMail,
  FiMapPin,
} from "react-icons/fi";
import Container from "@/components/ui/Container";
import siteConfig from "@/config/site";

// Social platform key -> icon. Only platforms with a configured URL are rendered.
const SOCIAL_ICONS = {
  instagram: FiInstagram,
  facebook: FiFacebook,
  twitter: FiTwitter,
  linkedin: FiLinkedin,
};

// Human labels for the social keys — `aria-label="twitter"` reads as a raw slug.
const SOCIAL_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
};

/**
 * Site footer. All content comes from siteConfig — no address, phone number, agency
 * name or link list is written into this file.
 *
 * There is no newsletter form here on purpose: no subscribe endpoint exists, and a
 * field that silently discards an address is worse than no field. Same reasoning as the
 * link columns, which only contain routes that are actually built.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    // `on-dark` keeps the focus ring legible across the whole navy region.
    <footer className="on-dark mt-auto bg-ink-deep text-white/70">
      <Container className="py-16 md:py-20">
        {/* Brand column is wider than the link columns — it carries the tagline. */}
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand + tagline + socials */}
          <div>
            <p className="font-display text-2xl text-white">{siteConfig.name}</p>
            <div className="mt-2 h-px w-12 bg-accent" aria-hidden="true" />
            <p className="mt-4 max-w-[40ch] text-sm">{siteConfig.tagline}</p>

            {/* Social icons — only those with a URL configured. Gold-bordered discs
                rather than bare glyphs, so the block has visual weight. */}
            <div className="mt-8 flex gap-3">
              {Object.entries(siteConfig.socials).map(([key, url]) => {
                const Icon = SOCIAL_ICONS[key];
                if (!url || !Icon) return null;
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={SOCIAL_LABELS[key] ?? key}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors duration-200 hover:border-accent hover:text-accent"
                  >
                    <Icon size={17} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns, driven entirely by config. */}
          {siteConfig.footerLinks.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
                {group.heading}
              </p>
              <ul className="mt-5 flex flex-col gap-3 text-sm">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="transition-colors duration-200 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Contact block. Icons are gold — decorative, and every line still has text. */}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
              Contact
            </p>
            <div className="mt-5 space-y-4 text-sm">
              <a
                href={`tel:${siteConfig.phone}`}
                className="flex items-start gap-3 transition-colors duration-200 hover:text-white"
              >
                <FiPhone size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
                {siteConfig.phone}
              </a>
              <a
                href={`mailto:${siteConfig.email}`}
                className="flex items-start gap-3 transition-colors duration-200 hover:text-white"
              >
                <FiMail size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
                {siteConfig.email}
              </a>
              <p className="flex items-start gap-3">
                <FiMapPin size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
                <span className="max-w-[28ch]">{siteConfig.address}</span>
              </p>
              {/* Office hours render as a list; an empty array simply renders nothing. */}
              {siteConfig.officeHours.length > 0 && (
                <div className="pl-7">
                  {siteConfig.officeHours.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-xs">
            © {year} {siteConfig.legalName}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}

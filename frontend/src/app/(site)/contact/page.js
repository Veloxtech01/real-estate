import { FiPhone, FiMail, FiMapPin, FiClock } from "react-icons/fi";
import Section from "@/components/ui/Section";
import EnquiryForm from "@/components/forms/EnquiryForm";
import OfficeMap from "@/components/contact/OfficeMap";
import contactContent from "@/content/contact";
import siteConfig from "@/config/site";

export const metadata = {
  title: `Contact us | ${siteConfig.name}`,
  description: contactContent.intro,
};

/**
 * Contact page (§3). Office details come from config/site.js — the established
 * source for this build (see lib/api/server.js's getSettings comment) — not a
 * fresh /api/settings read.
 */
export default function ContactPage() {
  return (
    <Section
      eyebrow={contactContent.eyebrow}
      title={contactContent.title}
      description={contactContent.intro}
      tone="light"
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        {/* Office details + map */}
        <div className="space-y-8">
          <div className="space-y-4 text-ink-soft">
            <a href={`tel:${siteConfig.phone}`} className="flex items-start gap-3 hover:text-ink">
              <FiPhone size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
              {siteConfig.phone}
            </a>
            <a
              href={`mailto:${siteConfig.email}`}
              className="flex items-start gap-3 hover:text-ink"
            >
              <FiMail size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
              {siteConfig.email}
            </a>
            <p className="flex items-start gap-3">
              <FiMapPin size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
              {siteConfig.address}
            </p>
            {siteConfig.officeHours.length > 0 && (
              <div className="flex items-start gap-3">
                <FiClock size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
                <div>
                  {siteConfig.officeHours.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <OfficeMap
            lat={siteConfig.officeCoordinates.lat}
            lng={siteConfig.officeCoordinates.lng}
            landmark={siteConfig.address}
            title={siteConfig.name}
          />
        </div>

        {/* General enquiry — no property attached */}
        <EnquiryForm
          type="general"
          source="contact_page"
          heading="Send us a message"
          subheading="Tell us what you're looking for and we'll get back to you."
        />
      </div>
    </Section>
  );
}

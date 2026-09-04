import { FiShield, FiUser, FiFileText } from "react-icons/fi";
import Section from "@/components/ui/Section";
import aboutContent from "@/content/about";
import siteConfig from "@/config/site";

// Positional icon set for the value points — same pattern as the homepage trust
// band's TRUST_ICONS (icons live in the page, not the content module).
const VALUE_ICONS = [FiShield, FiUser, FiFileText];

export const metadata = {
  title: `About us | ${siteConfig.name}`,
  description: aboutContent.intro,
};

/**
 * About page (§3) — agency story and credentials.
 *
 * Copy is local to content/about.js rather than pageModel-backed (see the design
 * spec's content-source decision) — same placeholder-until-launch status as
 * home.js.
 */
export default function AboutPage() {
  const hasCredentials =
    Boolean(siteConfig.lasreraNumber) || siteConfig.registrationNumbers.length > 0;

  return (
    <>
      <Section
        eyebrow={aboutContent.eyebrow}
        title={aboutContent.title}
        tone="dark"
        centered
      >
        <p className="mx-auto max-w-[68ch] text-center text-white/80">
          {aboutContent.intro}
        </p>
      </Section>

      <Section title={aboutContent.story.heading} tone="light">
        <p className="max-w-[68ch] whitespace-pre-line text-ink-soft">
          {aboutContent.story.body}
        </p>

        {/* Credentials shown only when configured — an absent one must not render
            as an empty claim (same reasoning as siteConfig.lasreraNumber being
            null rather than a placeholder-looking string). */}
        {hasCredentials && (
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
            {siteConfig.lasreraNumber && <span>LASRERA: {siteConfig.lasreraNumber}</span>}
            {siteConfig.registrationNumbers.map((reg) => (
              <span key={reg.body}>
                {reg.body}: {reg.number}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section
        eyebrow={aboutContent.values.eyebrow}
        title={aboutContent.values.title}
        tone="dark"
      >
        <div className="grid gap-10 md:grid-cols-3">
          {aboutContent.values.points.map((point, index) => {
            const Icon = VALUE_ICONS[index % VALUE_ICONS.length];
            return (
              <div key={point.title}>
                <div
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-xl text-white">{point.title}</h3>
                <p className="mt-3 max-w-[42ch] text-white/70">{point.body}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

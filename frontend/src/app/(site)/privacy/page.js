import Section from "@/components/ui/Section";
import { privacyContent } from "@/content/legal";

// Root layout's title template appends " — {siteConfig.name}" — don't repeat it here.
export const metadata = {
  title: "Privacy notice",
  description: privacyContent.description,
};

/**
 * Privacy notice (§4.1, §11) — how the site's forms collect and use personal data.
 * PLACEHOLDER LEGAL TEXT pending lawyer review, see content/legal.js.
 */
export default function PrivacyPage() {
  return (
    <>
      <Section
        eyebrow={privacyContent.eyebrow}
        title={privacyContent.title}
        description={privacyContent.description}
        tone="dark"
        centered
      />

      <Section tone="light">
        <article className="mx-auto max-w-2xl">
          <p className="text-sm text-muted">Last updated: {privacyContent.updated}</p>

          {/* Each clause is a heading + either paragraphs or a bullet list — never both,
              so the content stays simple enough to keep accurate without a CMS. */}
          {privacyContent.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mt-8 text-2xl text-ink">{section.heading}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-ink-soft">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-4 list-disc pl-6 text-ink-soft">
                  {section.list.map((item) => (
                    <li key={item} className="mt-1">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </Section>
    </>
  );
}

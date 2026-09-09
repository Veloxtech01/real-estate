import Section from "@/components/ui/Section";
import { termsContent } from "@/content/legal";

// Root layout's title template appends " — {siteConfig.name}" — don't repeat it here.
export const metadata = {
  title: "Terms of use",
  description: termsContent.description,
};

/**
 * Terms of use (§4.1, §11) — site usage terms and the listing-accuracy disclaimer.
 * PLACEHOLDER LEGAL TEXT pending lawyer review, see content/legal.js.
 */
export default function TermsPage() {
  return (
    <>
      <Section
        eyebrow={termsContent.eyebrow}
        title={termsContent.title}
        description={termsContent.description}
        tone="dark"
        centered
      />

      <Section tone="light">
        <article className="mx-auto max-w-2xl">
          <p className="text-sm text-muted">Last updated: {termsContent.updated}</p>

          {/* Same clause shape as the privacy notice — heading + paragraphs or a list. */}
          {termsContent.sections.map((section) => (
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

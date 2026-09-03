import Container from "@/components/ui/Container";

/**
 * A page section with the site's vertical rhythm and an optional heading block.
 * Generous spacing is the style, not an accident — do not tighten it per-section.
 *
 * @param {string} [eyebrow]     Small uppercase label above the title.
 * @param {string} [title]       Section heading (renders as h2).
 * @param {string} [description] Supporting line under the title.
 */
export default function Section({
  eyebrow,
  title,
  description,
  className = "",
  children,
}) {
  return (
    <section className={`py-16 md:py-24 lg:py-32 ${className}`}>
      <Container>
        {/* Heading block is optional — some sections are pure content. */}
        {(eyebrow || title || description) && (
          <div className="mb-10 max-w-2xl md:mb-14">
            {eyebrow && (
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-accent-text">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-3xl text-ink md:text-4xl lg:text-5xl">{title}</h2>
            )}
            {description && (
              <p className="mt-4 max-w-[68ch] text-ink-soft">{description}</p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

import Container from "@/components/ui/Container";

/**
 * A page section with the site's vertical rhythm and an optional heading block.
 * Generous spacing is the style, not an accident — do not tighten it per-section.
 *
 * `tone` is the site's main visual device: pages alternate ivory and navy grounds so
 * the layout has weight instead of being one continuous off-white field. Because gold
 * only passes contrast on navy (see globals.css), a section's tone also decides whether
 * gold is allowed to be loud in it — which is why this lives on Section rather than
 * being hand-rolled with a bg- class per page.
 *
 * @param {string} [eyebrow]     Small uppercase label above the title.
 * @param {string} [title]       Section heading (renders as h2).
 * @param {string} [description] Supporting line under the title.
 * @param {"light"|"raised"|"dark"} [tone] Ground colour. "dark" adds `on-dark`, which
 *                                         retargets the focus ring for the whole region.
 * @param {boolean} [centered]   Centre the heading block instead of left-aligning it.
 */

// Ground + the text colours that must change with it. Kept in one map so a tone can
// never be half-applied (a navy ground with navy body text is the classic slip).
const TONES = {
  light: {
    section: "bg-surface",
    eyebrow: "text-accent-text",
    title: "text-ink",
    description: "text-ink-soft",
  },
  raised: {
    section: "bg-surface-raised",
    eyebrow: "text-accent-text",
    title: "text-ink",
    description: "text-ink-soft",
  },
  dark: {
    // `on-dark` is not decorative — globals.css hangs the light focus ring off it.
    section: "bg-ink on-dark",
    // Brand gold, not the darkened one: on navy the darkened gold is nearly invisible.
    eyebrow: "text-accent",
    title: "text-white",
    description: "text-white/70",
  },
};

export default function Section({
  eyebrow,
  title,
  description,
  tone = "light",
  centered = false,
  className = "",
  children,
}) {
  const t = TONES[tone] ?? TONES.light;

  return (
    <section className={`py-16 md:py-24 lg:py-32 ${t.section} ${className}`}>
      <Container>
        {/* Heading block is optional — some sections are pure content. */}
        {(eyebrow || title || description) && (
          <div
            className={`mb-10 max-w-2xl md:mb-14 ${centered ? "mx-auto text-center" : ""}`}
          >
            {eyebrow && (
              <p
                className={`mb-3 text-xs font-medium uppercase tracking-[0.16em] ${t.eyebrow}`}
              >
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className={`text-3xl md:text-4xl lg:text-5xl ${t.title}`}>{title}</h2>
            )}
            {/* Gold rule under the heading — the mockup's signature mark. Decorative
                only, so it is hidden from assistive tech rather than read as content. */}
            {title && (
              <div
                className={`mt-6 h-px w-16 bg-accent ${centered ? "mx-auto" : ""}`}
                aria-hidden="true"
              />
            )}
            {description && (
              <p className={`mt-6 max-w-[68ch] ${t.description}`}>{description}</p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

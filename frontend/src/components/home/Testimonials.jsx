import Section from "@/components/ui/Section";
import homeContent from "@/content/home";

/**
 * Client testimonials, three across on an ivory ground.
 *
 * The quotes are placeholders held in content/home.js — see the warning there. When the
 * public testimonials endpoint ships, this takes an `items` prop from the server
 * component instead of reading the content module, and nothing else here changes.
 *
 * No avatars: the mockup's stock headshots would be photographs of people who never
 * said these words. A name and a role carry the same layout weight without inventing a
 * face, and stay correct once the copy is real.
 */
export default function Testimonials() {
  const { eyebrow, title, items = [] } = homeContent.testimonials ?? {};
  // An empty rail reads as a fault — omit the section entirely instead.
  if (items.length === 0) return null;

  return (
    <Section eyebrow={eyebrow} title={title} tone="raised">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          // <figure>/<blockquote>/<figcaption> is the correct structure for a quote
          // with an attribution — it is what carries the relationship to a screen reader.
          <figure
            key={item.quote}
            className="flex h-full flex-col rounded-lg border border-border bg-surface p-7 transition-colors duration-200 hover:border-accent"
          >
            {/* Oversized gold quote mark. Decorative — the quote itself is the text,
                so this must not be read out as a stray character. */}
            <span
              className="font-display text-5xl leading-none text-accent"
              aria-hidden="true"
            >
              &ldquo;
            </span>

            <blockquote className="mt-4 flex-1 text-ink-soft">{item.quote}</blockquote>

            <figcaption className="mt-6 border-t border-border pt-5">
              <p className="font-medium text-ink">{item.name}</p>
              <p className="mt-0.5 text-sm text-muted">{item.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

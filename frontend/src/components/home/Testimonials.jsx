import Section from "@/components/ui/Section";

/**
 * Client testimonials, three across on an ivory ground.
 *
 * `items` comes from GET /api/testimonials via the homepage server component — this
 * component holds no fallback content of its own. An empty rail reads as a fault, so
 * an empty or omitted `items` renders nothing rather than an empty grid; that is also
 * today's honest state until real testimonials are curated (see the design spec).
 *
 * No avatars: a stock headshot would be a photograph of someone who never said these
 * words. A name and a role carry the same layout weight without inventing a face.
 */
export default function Testimonials({ eyebrow, title, items = [] }) {
  if (items.length === 0) return null;

  return (
    <Section eyebrow={eyebrow} title={title} tone="raised">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          // <figure>/<blockquote>/<figcaption> is the correct structure for a quote
          // with an attribution — it is what carries the relationship to a screen reader.
          <figure
            key={item._id}
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
              <p className="font-medium text-ink">{item.clientName}</p>
              <p className="mt-0.5 text-sm text-muted">{item.clientTitle}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

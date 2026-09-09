import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/search/SearchBar";
import HeroSearchPanel from "@/components/home/HeroSearchPanel";
import homeContent from "@/content/home";

/**
 * Homepage hero: a full-bleed photograph under a navy scrim, carrying the headline,
 * the free-text search and — straddling its lower edge — the structured search panel.
 *
 * The scrim is not a mood effect. White display type over an unmodified photograph is
 * unreadable wherever the image happens to be pale, and the image is decorative stock
 * that will be swapped per client, so the text cannot depend on any particular part of
 * it being dark. The gradient guarantees the contrast regardless of the photo used.
 *
 * @param {object} filterOptions `GET /api/filters`, passed through to the panel.
 */
export default function Hero({ filterOptions }) {
  return (
    // `on-dark` keeps the focus ring legible on the navy; `isolate` gives the scrim and
    // content a stacking context of their own so neither escapes over the sticky header.
    <section className="on-dark relative isolate overflow-hidden bg-ink-deep">
      {/* Background photograph. `priority` because this is the LCP element. */}
      <Image
        src="/hero-home.jpg"
        // Empty alt: the photo is decorative stock, not information about any listing.
        // Describing it would announce a property the agency is not actually offering.
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/* Scrim. Two layers: a horizontal wash that keeps the left-hand copy legible,
          and a vertical one that lands the bottom edge on solid navy so the search
          panel and the section beneath it join without a visible seam. */}
      <div
        className="absolute inset-0 bg-linear-to-r from-ink-deep via-ink-deep/85 to-ink-deep/40"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-linear-to-b from-ink-deep/60 via-transparent to-ink-deep"
        aria-hidden="true"
      />

      {/* Content sits above both scrim layers. Top padding is modest — the header is
          `sticky` and already sits in normal flow above the hero, not overlaid on top
          of it, so this only needs to add breathing room, not clear a fixed header. */}
      <Container className="relative pt-12 pb-10 md:pt-16 md:pb-12 lg:pt-14">
        <div className="max-w-3xl">
          {/* Gold eyebrow — legible here precisely because the ground is navy. */}
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-accent">
            {homeContent.hero.eyebrow}
          </p>

          <h1 className="text-[clamp(2.5rem,6.5vw,5rem)] leading-[1.05] tracking-[-0.03em] text-white">
            {homeContent.hero.heading}
          </h1>

          <p className="mt-6 max-w-[52ch] text-lg text-white/75">
            {homeContent.hero.subheading}
          </p>

          {/* Free-text search — the natural-language feature, and the primary path. */}
          <div className="mt-9 max-w-2xl">
            <SearchBar tone="dark" />
          </div>

          {/* Secondary route for a visitor who would rather browse than describe.
              Both are outlined, not filled: search is the hero's primary action and the
              gold fill belongs to it. Three gold buttons stacked on a narrow viewport
              would leave no primary at all. */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/properties" variant="onDarkOutline" size="lg">
              {homeContent.hero.action}
              <FiArrowRight size={16} aria-hidden="true" />
            </Button>
            <Button
              href="/properties?listingType=rent"
              variant="onDarkGhost"
              size="lg"
            >
              Homes to let
            </Button>
          </div>
        </div>
      </Container>

      {/* Structured panel. Inside the hero rather than overlapping it from below, so it
          cannot collide with the next section on a narrow viewport. */}
      <Container className="relative pb-12 md:pb-16">
        <HeroSearchPanel options={filterOptions} />
      </Container>
    </section>
  );
}

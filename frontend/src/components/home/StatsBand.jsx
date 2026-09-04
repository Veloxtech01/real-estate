import { FiHome, FiUsers, FiMapPin, FiAward } from "react-icons/fi";
import Container from "@/components/ui/Container";
import homeContent from "@/content/home";

/**
 * Four-figure credibility band, on navy so the gold numerals and icon discs carry.
 *
 * The figures are placeholders held in content/home.js — see the warning there. This
 * component renders whatever it is given and makes no claim of its own; if the stats
 * array is emptied, the section disappears rather than rendering an empty rail.
 *
 * Icons are positional, not semantic: they are decorative marks for the four slots in
 * order, which is why they live here rather than being named in the content file. Every
 * figure is also stated in words beneath it, so nothing depends on the icon being read.
 */

// One icon per slot, in content order.
const ICONS = [FiHome, FiUsers, FiMapPin, FiAward];

export default function StatsBand() {
  const stats = homeContent.stats ?? [];
  if (stats.length === 0) return null;

  return (
    // `on-dark` retargets the focus ring; there is nothing focusable here today, but
    // the band is navy and the rule should not depend on that staying true.
    <section className="on-dark bg-ink py-16 md:py-20">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <div key={stat.label} className="text-center">
                {/* Filled gold disc — the device that gives the band its weight. A thin
                    outline icon at this size disappears against the navy. */}
                <div
                  className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30"
                  aria-hidden="true"
                >
                  <Icon size={24} />
                </div>
                {/* Display face + tabular figures so the four numerals sit on a grid. */}
                <p className="tabular font-display text-4xl text-white md:text-5xl">
                  {stat.value}
                </p>
                <p className="mt-3 text-sm font-medium text-accent">{stat.label}</p>
                <p className="mt-1 text-sm text-white/60">{stat.caption}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

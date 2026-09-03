import { FiInfo } from "react-icons/fi";

/**
 * Tells the visitor when the backend widened their search to find results (scope §5.5).
 *
 * Without this, a Lekki searcher shown listings from a neighbouring area reads the page
 * as broken. The rungs come back in order from the API.
 */

// Rung key -> the sentence shown to the visitor.
const RUNG_COPY = {
  price_band: "we widened the price range",
  nearby_areas: "we included nearby areas in the same state",
  bedrooms: "we relaxed the bedroom count",
};

export default function RelaxationNotice({ relaxed = [], unmatched = [] }) {
  // Nothing was widened and everything was understood — say nothing.
  if (relaxed.length === 0 && unmatched.length === 0) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-ink-soft">
      <FiInfo size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
      <div className="space-y-1">
        {relaxed.length > 0 && (
          <p>
            No exact matches, so {relaxed.map((rung) => RUNG_COPY[rung] ?? rung).join(", and ")}.
          </p>
        )}
        {/* Terms the site does not cover are surfaced, not silently dropped. */}
        {unmatched.length > 0 && (
          <p>
            We don&apos;t cover {unmatched.join(", ")} yet — those parts of your search were
            ignored.
          </p>
        )}
      </div>
    </div>
  );
}

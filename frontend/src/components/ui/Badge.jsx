/**
 * Small status/label pill. Always renders its text: status is never communicated by
 * colour alone (accessibility floor, design system §5).
 */

/*
 * Tones are solid fills, not 10% washes. A badge that sits on a photograph — which is
 * where the status badge always sits — has to carry its own ground, or it reads as
 * whatever colour the image happens to be behind it.
 *
 * Every fill pairs with a label colour above 4.5:1 against that fill: white on the
 * three status colours, navy on gold (6.6:1 — gold with white text would be 1.9:1).
 */
const TONES = {
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  muted: "bg-ink text-white",
  accent: "bg-accent text-ink",
};

export default function Badge({ tone = "muted", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium uppercase tracking-[0.06em] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

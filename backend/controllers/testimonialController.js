import Testimonial from "../model/testimonialModel.js";

/**
 * Public testimonials — agency-curated client feedback (§3). Not a public review
 * system: entries are staff-entered and there is no submission path (see the
 * model's own comment).
 *
 * An explicit inclusion whitelist keeps `isPublished`, `displayOrder`, `agent` and
 * `property` off this API — none of those are meant for public consumption.
 */
const PUBLIC_FIELDS = "clientName clientTitle quote photo rating";

/**
 * GET /api/testimonials — published testimonials, in curator-set order.
 *
 * Takes: (req, res); optional req.query.limit.
 * Returns: nothing; sends { success, data: { testimonials } }. An empty array is a
 *          legitimate answer — nothing has been curated yet — not an error.
 */
export async function listTestimonials(req, res) {
  const limit = Number(req.query.limit);

  let query = Testimonial.find({ isPublished: true })
    .select(PUBLIC_FIELDS)
    .sort({ displayOrder: 1 });

  // A non-numeric or non-positive limit is ignored rather than rejected — a stale
  // or malformed query param shouldn't cost the homepage its testimonials rail.
  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const testimonials = await query.lean();

  res.status(200).json({ success: true, data: { testimonials } });
}

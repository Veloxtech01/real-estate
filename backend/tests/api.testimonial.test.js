import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import Testimonial from "../model/testimonialModel.js";

/**
 * Public testimonials API (§3) — agency-curated client feedback, never a public
 * review system. Each test creates its own testimonials for isolation, same style
 * as api.agent.test.js.
 */
describe("Public testimonials API", () => {
  const app = createApp();

  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  /** Creates a published testimonial with sane defaults, overridable per test. */
  async function createTestimonial(overrides = {}) {
    return Testimonial.create({
      clientName: "Adaeze Okonkwo",
      clientTitle: "Buyer, Lekki",
      quote: "They confirmed the title before we ever booked a viewing.",
      isPublished: true,
      displayOrder: 0,
      ...overrides,
    });
  }

  it("returns only published testimonials, ordered by displayOrder", async () => {
    await createTestimonial({ clientName: "Second", displayOrder: 1 });
    await createTestimonial({ clientName: "First", displayOrder: 0 });
    await createTestimonial({
      clientName: "Hidden",
      isPublished: false,
      displayOrder: -1,
    });

    const response = await request(app).get("/api/testimonials");

    expect(response.status).toBe(200);
    expect(response.body.data.testimonials.map((t) => t.clientName)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("caps the result count with ?limit=", async () => {
    await createTestimonial({ clientName: "A", displayOrder: 0 });
    await createTestimonial({ clientName: "B", displayOrder: 1 });
    await createTestimonial({ clientName: "C", displayOrder: 2 });

    const response = await request(app).get("/api/testimonials?limit=2");

    expect(response.body.data.testimonials).toHaveLength(2);
  });

  it("never returns an unpublished testimonial regardless of displayOrder", async () => {
    await createTestimonial({
      clientName: "Unpublished",
      isPublished: false,
      displayOrder: 0,
    });

    const response = await request(app).get("/api/testimonials");

    expect(response.body.data.testimonials).toHaveLength(0);
  });
});
